// ============================================================================
// CLARENCE CREATE PHASE - SIMPLE PROGRESS HEADER
// ============================================================================
// File: components/create-phase/CreateProgressHeader.tsx
// Purpose: Simple progress indicator for Create Phase pages
// Version: 1.0
// ============================================================================

'use client';

import React from 'react';
import Link from 'next/link';
import { Check, Circle } from 'lucide-react';

// ============================================================================
// SECTION 1: TYPE DEFINITIONS
// ============================================================================

export type CreateStage =
    | 'create_contract'
    | 'strategic_assessment'
    | 'contract_prep'
    | 'invite_providers';

interface StageConfig {
    id: CreateStage;
    label: string;
    shortLabel: string;
}

interface CreateProgressHeaderProps {
    /** Current stage */
    currentStage: CreateStage;
    /** Session ID for navigation links */
    sessionId?: string | null;
    /** Contract ID for navigation links */
    contractId?: string | null;
    /** Pathway ID for navigation links */
    pathwayId?: string | null;
    /** Whether to show the CLARENCE branding */
    showBranding?: boolean;
    /** Custom title to display */
    pageTitle?: string;
    /** Right side content (session info, etc.) */
    rightContent?: React.ReactNode;
    /** Is this a Straight to Contract flow (hides assessment) */
    isStraightToContract?: boolean;
    /** Completed stages */
    completedStages?: CreateStage[];
}

// ============================================================================
// SECTION 2: STAGE CONFIGURATION
// ============================================================================

const STAGES: StageConfig[] = [
    { id: 'create_contract', label: 'Create Contract', shortLabel: 'Create' },
    { id: 'strategic_assessment', label: 'Strategic Assessment', shortLabel: 'Strategy' },
    { id: 'contract_prep', label: 'Contract Prep', shortLabel: 'Prep' },
    { id: 'invite_providers', label: 'Invite Providers', shortLabel: 'Invite' },
];

// Stages for Straight to Contract (skip assessment and prep)
const STC_STAGES: StageConfig[] = [
    { id: 'create_contract', label: 'Create Contract', shortLabel: 'Create' },
    { id: 'invite_providers', label: 'Invite Providers', shortLabel: 'Invite' },
];

// ============================================================================
// SECTION 3: HELPER FUNCTIONS
// ============================================================================

function getStageIndex(stageId: CreateStage, stages: StageConfig[]): number {
    return stages.findIndex(s => s.id === stageId);
}

function getStageStatus(
    stage: StageConfig,
    currentStage: CreateStage,
    stages: StageConfig[],
    completedStages: CreateStage[]
): 'completed' | 'active' | 'pending' {
    const stageIndex = getStageIndex(stage.id, stages);
    const currentIndex = getStageIndex(currentStage, stages);

    if (completedStages.includes(stage.id)) {
        return 'completed';
    }
    if (stageIndex < currentIndex) {
        return 'completed';
    }
    if (stageIndex === currentIndex) {
        return 'active';
    }
    return 'pending';
}

function buildStageUrl(
    stage: CreateStage,
    sessionId?: string | null,
    contractId?: string | null,
    pathwayId?: string | null
): string | null {
    if (!sessionId) return null;

    const params = new URLSearchParams();
    params.set('session_id', sessionId);
    if (contractId) params.set('contract_id', contractId);
    if (pathwayId) params.set('pathway_id', pathwayId);

    const routes: Record<CreateStage, string> = {
        create_contract: '/auth/create-contract',
        strategic_assessment: '/auth/strategic-assessment',
        contract_prep: '/auth/contract-prep',
        invite_providers: '/auth/invite-providers',
    };

    return `${routes[stage]}?${params.toString()}`;
}

// ============================================================================
// SECTION 4: PROGRESS STEP COMPONENT
// ============================================================================

const ProgressStep: React.FC<{
    stage: StageConfig;
    status: 'completed' | 'active' | 'pending';
    isLast: boolean;
    url: string | null;
    isClickable: boolean;
}> = ({ stage, status, isLast, url, isClickable }) => {
    const getStyles = () => {
        switch (status) {
            case 'completed':
                return {
                    circle: 'bg-emerald-500 border-emerald-500 text-white',
                    line: 'bg-emerald-500',
                    label: 'text-emerald-400',
                };
            case 'active':
                return {
                    circle: 'bg-emerald-500 border-emerald-500 text-white ring-2 ring-emerald-300 ring-offset-2 ring-offset-slate-800',
                    line: 'bg-slate-600',
                    label: 'text-white font-medium',
                };
            case 'pending':
            default:
                return {
                    circle: 'bg-slate-700 border-slate-600 text-slate-500',
                    line: 'bg-slate-600',
                    label: 'text-slate-500',
                };
        }
    };

    const styles = getStyles();

    const CircleContent = (
        <div className="flex flex-col items-center">
            <div
                className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${styles.circle}`}
            >
                {status === 'completed' ? (
                    <Check size={14} strokeWidth={3} />
                ) : status === 'active' ? (
                    <Circle size={8} fill="currentColor" />
                ) : (
                    <Circle size={8} className="opacity-0" />
                )}
            </div>
            <span className={`mt-1.5 text-xs whitespace-nowrap transition-colors ${styles.label}`}>
                {stage.shortLabel}
            </span>
        </div>
    );

    return (
        <div className="flex items-center">
            {isClickable && url && status === 'completed' ? (
                <Link href={url} className="hover:opacity-80 transition-opacity">
                    {CircleContent}
                </Link>
            ) : (
                CircleContent
            )}

            {!isLast && (
                <div
                    className={`h-0.5 flex-1 mx-3 transition-all duration-300 ${styles.line}`}
                    style={{ minWidth: '32px' }}
                />
            )}
        </div>
    );
};

// ============================================================================
// SECTION 5: MAIN COMPONENT
// ============================================================================

export const CreateProgressHeader: React.FC<CreateProgressHeaderProps> = ({
    currentStage,
    sessionId,
    contractId,
    pathwayId,
    showBranding = true,
    pageTitle,
    rightContent,
    isStraightToContract = false,
    completedStages = [],
}) => {
    const stages = isStraightToContract ? STC_STAGES : STAGES;
    const currentIndex = getStageIndex(currentStage, stages);
    const percentage = Math.round(((currentIndex + 1) / stages.length) * 100);

    return (
        <header className="bg-slate-800">
            {/* Main Header Row */}
            <div className="h-14 flex items-center justify-between px-6 relative">
                {/* Left: CLARENCE Create branding */}
                {showBranding && (
                    <div className="flex items-center gap-3">
                        <Link href="/auth/contracts-dashboard" className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold">C</span>
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-white font-semibold">CLARENCE</span>
                                    <span className="text-emerald-400 font-semibold">Create</span>
                                </div>
                                <span className="text-slate-500 text-xs">The Honest Broker</span>
                            </div>
                        </Link>
                    </div>
                )}

                {/* Centre: Page Title */}
                {pageTitle && (
                    <div className="absolute left-1/2 transform -translate-x-1/2">
                        <h1 className="text-white font-medium">{pageTitle}</h1>
                    </div>
                )}

                {/* Right: Custom content or session info */}
                <div className="flex items-center gap-4">
                    {rightContent}
                </div>
            </div>

            {/* Progress Bar Row */}
            <div className="px-6 py-3 border-t border-slate-700">
                <div className="max-w-2xl mx-auto">
                    {/* Progress Steps */}
                    <div className="flex items-start justify-between">
                        {stages.map((stage, index) => (
                            <ProgressStep
                                key={stage.id}
                                stage={stage}
                                status={getStageStatus(stage, currentStage, stages, completedStages)}
                                isLast={index === stages.length - 1}
                                url={buildStageUrl(stage.id, sessionId, contractId, pathwayId)}
                                isClickable={true}
                            />
                        ))}
                    </div>

                    {/* Progress percentage */}
                    <div className="mt-3 flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-emerald-500 rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${percentage}%` }}
                            />
                        </div>
                        <span className="text-xs text-slate-400 min-w-[60px] text-right">
                            {percentage}% complete
                        </span>
                    </div>
                </div>
            </div>
        </header>
    );
};

// ============================================================================
// SECTION 6: COMPACT VERSION (for pages with existing headers)
// ============================================================================

export const CreateProgressBar: React.FC<{
    currentStage: CreateStage;
    isStraightToContract?: boolean;
    completedStages?: CreateStage[];
    className?: string;
}> = ({ currentStage, isStraightToContract = false, completedStages = [], className = '' }) => {
    const stages = isStraightToContract ? STC_STAGES : STAGES;
    const currentIndex = getStageIndex(currentStage, stages);
    const percentage = Math.round(((currentIndex + 1) / stages.length) * 100);
    const currentStageConfig = stages.find(s => s.id === currentStage);

    return (
        <div className={`bg-white border-b border-slate-200 px-6 py-3 ${className}`}>
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-600">
                        Step {currentIndex + 1} of {stages.length}: <span className="font-medium text-slate-800">{currentStageConfig?.label}</span>
                    </span>
                    <span className="text-xs text-slate-500">{percentage}% complete</span>
                </div>
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${percentage}%` }}
                    />
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// SECTION 7: EXPORTS
// ============================================================================

export default CreateProgressHeader;