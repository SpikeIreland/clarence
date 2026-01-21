// ============================================================================
// CLARENCE CREATE PHASE - COMPONENT EXPORTS
// ============================================================================
// File: components/create-phase/index.ts
// Purpose: Central export for all Create Phase components
// Version: 1.0
// ============================================================================

// Progress Bar Components
export {
    CreatePhaseProgressBar,
    CreatePhaseProgressLinear,
} from './CreatePhaseProgressBar';

// Transition Modal Components
export {
    TransitionModal,
    TransitionModalController,
    TransitionBanner,
    useTransitionModal,
} from './TransitionModal';

// Layout Components
export {
    CreatePhaseLayout,
    CreatePhaseProgressWrapper,
    useCreatePhase,
} from './CreatePhaseLayout';

// Re-export types from pathway-utils for convenience
export type {
    PathwayId,
    PathwayState,
    StageId,
    StageStatus,
    TransitionId,
    MediationType,
    TemplateSource,
    ProgressGroup,
} from '@/lib/pathway-utils';