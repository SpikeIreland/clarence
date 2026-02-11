// ============================================================================
// FILE: app/components/PositionScaleIndicator.tsx
// PURPOSE: Reusable "Favours You / Favours Them" indicator for position scales
// DEPLOY TO: /app/components/PositionScaleIndicator.tsx
// ============================================================================
// Renders above any position scale (slider, bar, etc.) to show the user
// which end of the 1-10 scale favours them vs the other party.
//
// Usage:
//   <PositionScaleIndicator roleContext={roleContext} />
//   <PositionScaleIndicator roleContext={roleContext} variant="compact" />
//   <PositionScaleIndicator roleContext={roleContext} variant="labels-only" />
// ============================================================================

'use client'

import type { RoleContext } from '@/lib/role-matrix'
import { getScaleLabels } from '@/lib/useRoleContext'


// ============================================================================
// SECTION 1: PROPS
// ============================================================================

interface PositionScaleIndicatorProps {
    roleContext: RoleContext | null
    variant?: 'full' | 'compact' | 'labels-only'
    className?: string
}


// ============================================================================
// SECTION 2: FULL VARIANT (default)
// ============================================================================
// Shows: Party label + "Favours You/Them" on each end with gradient bar

function FullIndicator({ roleContext }: { roleContext: RoleContext }) {
    const labels = getScaleLabels(roleContext)
    const youOnLeft = roleContext.positionFavorEnd === 1

    return (
        <div className="w-full">
            {/* You / Them indicators */}
            <div className="flex justify-between mb-1">
                <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${youOnLeft ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    <span className={`text-xs font-semibold ${youOnLeft ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {labels.leftYouThem}
                    </span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-semibold ${!youOnLeft ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {labels.rightYouThem}
                    </span>
                    <div className={`w-2 h-2 rounded-full ${!youOnLeft ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                </div>
            </div>

            {/* Party labels */}
            <div className="flex justify-between">
                <span className="text-xs text-slate-500">{labels.leftLabel}</span>
                <span className="text-xs text-slate-500">{labels.rightLabel}</span>
            </div>
        </div>
    )
}


// ============================================================================
// SECTION 3: COMPACT VARIANT
// ============================================================================
// Shows just "Favours You" / "Favours Them" with dots, no party labels

function CompactIndicator({ roleContext }: { roleContext: RoleContext }) {
    const labels = getScaleLabels(roleContext)
    const youOnLeft = roleContext.positionFavorEnd === 1

    return (
        <div className="flex justify-between w-full">
            <span className={`text-xs font-medium ${youOnLeft ? 'text-emerald-600' : 'text-slate-400'}`}>
                {youOnLeft ? '← You' : '← Them'}
            </span>
            <span className={`text-xs font-medium ${!youOnLeft ? 'text-emerald-600' : 'text-slate-400'}`}>
                {!youOnLeft ? 'You →' : 'Them →'}
            </span>
        </div>
    )
}


// ============================================================================
// SECTION 4: LABELS-ONLY VARIANT
// ============================================================================
// Shows dynamic party labels without You/Them (drop-in replacement for
// the current hardcoded "Provider-Favoring" / "Customer-Favoring" text)

function LabelsOnlyIndicator({ roleContext }: { roleContext: RoleContext }) {
    const labels = getScaleLabels(roleContext)

    return (
        <div className="flex justify-between w-full">
            <span className="text-xs text-slate-500">{labels.leftLabel}</span>
            <span className="text-xs text-slate-500">{labels.rightLabel}</span>
        </div>
    )
}


// ============================================================================
// SECTION 5: MAIN EXPORT
// ============================================================================

export default function PositionScaleIndicator({
    roleContext,
    variant = 'full',
    className = '',
}: PositionScaleIndicatorProps) {
    // Fallback when no role context
    if (!roleContext) {
        return (
            <div className={`flex justify-between w-full ${className}`}>
                <span className="text-xs text-slate-500">Provider-Favoring</span>
                <span className="text-xs text-slate-500">Customer-Favoring</span>
            </div>
        )
    }

    return (
        <div className={className}>
            {variant === 'full' && <FullIndicator roleContext={roleContext} />}
            {variant === 'compact' && <CompactIndicator roleContext={roleContext} />}
            {variant === 'labels-only' && <LabelsOnlyIndicator roleContext={roleContext} />}
        </div>
    )
}


// ============================================================================
// SECTION 6: INLINE POSITION BADGE HELPER
// ============================================================================
// For use in clause lists and small indicators where you just need
// a coloured badge showing whether a position favours the current user.

interface PositionBadgeProps {
    position: number
    roleContext: RoleContext | null
    size?: 'sm' | 'md'
}

export function PositionFavourBadge({ position, roleContext, size = 'sm' }: PositionBadgeProps) {
    if (!roleContext) return null

    const { positionFavorEnd } = roleContext

    // Determine if this position favours the current user
    let favoursUser: boolean
    if (positionFavorEnd === 10) {
        // User is protected party - high positions favour them
        favoursUser = position >= 7
    } else {
        // User is providing party - low positions favour them
        favoursUser = position <= 3
    }

    const isBalanced = position >= 4 && position <= 6

    const sizeClasses = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1'

    if (isBalanced) {
        return (
            <span className={`${sizeClasses} rounded bg-amber-100 text-amber-700 font-medium`}>
                Balanced
            </span>
        )
    }

    if (favoursUser) {
        return (
            <span className={`${sizeClasses} rounded bg-emerald-100 text-emerald-700 font-medium`}>
                Favours You
            </span>
        )
    }

    return (
        <span className={`${sizeClasses} rounded bg-slate-100 text-slate-500 font-medium`}>
            Favours Them
        </span>
    )
}