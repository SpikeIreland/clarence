// ============================================================================
// CLARENCE CREATE PHASE - PROGRESS BAR COMPONENT
// ============================================================================
// File: components/create-phase/CreatePhaseProgressBar.tsx
// Purpose: Visual progress indicator for the Create Phase journey
// Version: 1.0
// ============================================================================

'use client';

import React from 'react';
import {
    PathwayId,
    PathwayState,
    ProgressGroup,
    PROGRESS_GROUPS,
    getGroupProgress,
    calculateProgress,
    getStageMetadata,
    isStageRequired,
} from '@/lib/pathway-utils';
import { Check, Circle, Minus } from 'lucide-react';

// ============================================================================
// SECTION 1: TYPE DEFINITIONS
// ============================================================================

interface CreatePhaseProgressBarProps {
    /** The pathway ID for this session */
    pathwayId: PathwayId;
    /** Current pathway state */
    pathwayState: PathwayState;
    /** Whether to show the detailed view with stage names */
    showDetails?: boolean;
    /** Whether to show the percentage */
    showPercentage?: boolean;
    /** Optional className for custom styling */
    className?: string;
    /** Compact mode for smaller spaces */
    compact?: boolean;
}

type GroupStatus = 'completed' | 'active' | 'pending' | 'skipped';

// ============================================================================
// SECTION 2: HELPER COMPONENTS
// ============================================================================

/**
 * Individual progress step indicator
 */
const ProgressStep: React.FC<{
    label: string;
    status: GroupStatus;
    isLast: boolean;
    compact: boolean;
}> = ({ label, status, isLast, compact }) => {
    // Determine colors based on status
    const getStepStyles = () => {
        switch (status) {
            case 'completed':
                return {
                    circle: 'bg-emerald-500 border-emerald-500 text-white',
                    line: 'bg-emerald-500',
                    label: 'text-emerald-700 font-medium',
                };
            case 'active':
                return {
                    circle: 'bg-white border-emerald-500 border-2 text-emerald-500',
                    line: 'bg-slate-200',
                    label: 'text-emerald-600 font-semibold',
                };
            case 'skipped':
                return {
                    circle: 'bg-slate-100 border-slate-300 border text-slate-400',
                    line: 'bg-slate-200',
                    label: 'text-slate-400 line-through',
                };
            case 'pending':
            default:
                return {
                    circle: 'bg-white border-slate-300 border text-slate-400',
                    line: 'bg-slate-200',
                    label: 'text-slate-500',
                };
        }
    };

    const styles = getStepStyles();
    const circleSize = compact ? 'w-6 h-6' : 'w-8 h-8';
    const iconSize = compact ? 14 : 16;

    return (
        <div className="flex items-center">
            {/* Step Circle */}
            <div className="flex flex-col items-center">
                <div
                    className={`${circleSize} rounded-full flex items-center justify-center transition-all duration-300 ${styles.circle}`}
                >
                    {status === 'completed' && <Check size={iconSize} strokeWidth={3} />}
                    {status === 'active' && <Circle size={iconSize - 4} fill="currentColor" />}
                    {status === 'skipped' && <Minus size={iconSize} />}
                    {status === 'pending' && <Circle size={iconSize - 4} className="opacity-0" />}
                </div>

                {/* Label below circle */}
                {!compact && (
                    <span className={`mt-2 text-xs whitespace-nowrap ${styles.label}`}>
                        {label}
                    </span>
                )}
            </div>

            {/* Connector Line */}
            {!isLast && (
                <div
                    className={`h-0.5 flex-1 mx-2 transition-all duration-300 ${styles.line}`}
                    style={{ minWidth: compact ? '16px' : '24px' }}
                />
            )}
        </div>
    );
};

/**
 * Progress percentage badge
 */
const ProgressBadge: React.FC<{ percentage: number }> = ({ percentage }) => {
    const getColor = () => {
        if (percentage >= 80) return 'bg-emerald-100 text-emerald-700';
        if (percentage >= 50) return 'bg-amber-100 text-amber-700';
        return 'bg-slate-100 text-slate-600';
    };

    return (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getColor()}`}>
            {percentage}% complete
        </span>
    );
};

// ============================================================================
// SECTION 3: MAIN COMPONENT
// ============================================================================

export const CreatePhaseProgressBar: React.FC<CreatePhaseProgressBarProps> = ({
    pathwayId,
    pathwayState,
    showDetails = true,
    showPercentage = true,
    className = '',
    compact = false,
}) => {
    // Calculate progress data
    const groupProgress = getGroupProgress(pathwayId, pathwayState);
    const percentage = calculateProgress(pathwayId, pathwayState);

    // Get current stage info for display
    const currentStageMetadata = getStageMetadata(pathwayState.currentStage);

    // Filter groups that have at least one required stage
    const visibleGroups = PROGRESS_GROUPS.filter(group => {
        return group.stages.some(stageId => isStageRequired(pathwayId, stageId));
    });

    return (
        <div className={`${className}`}>
            {/* Header with current stage and percentage */}
            {showDetails && (
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <p className="text-sm text-slate-500">Current Step</p>
                        <p className="text-base font-semibold text-slate-800">
                            {currentStageMetadata.label}
                        </p>
                    </div>
                    {showPercentage && <ProgressBadge percentage={percentage} />}
                </div>
            )}

            {/* Progress Steps */}
            <div className="flex items-start justify-between">
                {visibleGroups.map((group, index) => (
                    <ProgressStep
                        key={group.id}
                        label={group.label}
                        status={groupProgress[group.id]}
                        isLast={index === visibleGroups.length - 1}
                        compact={compact}
                    />
                ))}
            </div>

            {/* Compact mode: show label below */}
            {compact && showDetails && (
                <p className="text-xs text-slate-500 mt-2 text-center">
                    {currentStageMetadata.label}
                </p>
            )}
        </div>
    );
};

// ============================================================================
// SECTION 4: SIMPLIFIED PROGRESS BAR (Alternative)
// ============================================================================

/**
 * A simpler linear progress bar for tight spaces
 */
export const CreatePhaseProgressLinear: React.FC<{
    pathwayId: PathwayId;
    pathwayState: PathwayState;
    showLabel?: boolean;
    className?: string;
}> = ({ pathwayId, pathwayState, showLabel = true, className = '' }) => {
    const percentage = calculateProgress(pathwayId, pathwayState);
    const currentStageMetadata = getStageMetadata(pathwayState.currentStage);

    return (
        <div className={className}>
            {showLabel && (
                <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-600">{currentStageMetadata.label}</span>
                    <span className="text-xs text-slate-500">{percentage}%</span>
                </div>
            )}
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
};

// ============================================================================
// SECTION 5: EXPORTS
// ============================================================================

export default CreatePhaseProgressBar;