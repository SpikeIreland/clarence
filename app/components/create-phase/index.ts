// ============================================================================
// CLARENCE CREATE PHASE - COMPONENT EXPORTS
// ============================================================================
// File: components/create-phase/index.ts
// Purpose: Central export for all Create Phase components
// Version: 1.1 - Fixed to match actual component exports
// ============================================================================

// Progress Bar Components
// CreatePhaseProgressBar is a default export, CreatePhaseProgressLinear is named
import CreatePhaseProgressBar from './CreatePhaseProgressBar';
export { CreatePhaseProgressBar };
export { CreatePhaseProgressLinear } from './CreatePhaseProgressBar';

// Transition Modal Component
// TransitionModal is a default export
import TransitionModal from './TransitionModal';
export { TransitionModal };

// Layout Components
// CreatePhaseLayout is a default export, CreatePhaseProgressWrapper is named
import CreatePhaseLayout from './CreatePhaseLayout';
export { CreatePhaseLayout };
export { CreatePhaseProgressWrapper } from './CreatePhaseLayout';

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
    TransitionConfig,
} from '@/lib/pathway-utils';