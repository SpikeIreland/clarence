// ============================================================================
// FILE: app/api/playbooks/[playbookId]/rules/[ruleId]/route.ts
// PURPOSE: PATCH endpoint for updating individual playbook rules
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase'

// ============================================================================
// SECTION 1: ALLOWED FIELDS & VALIDATION
// ============================================================================

const ALLOWED_FIELDS = [
    'ideal_position',
    'minimum_position',
    'maximum_position',
    'fallback_position',
    'range_context',
    'rationale',
    'negotiation_tips',
    'importance_level',
    'is_deal_breaker',
    'is_non_negotiable',
    'escalation_trigger',
    'escalation_contact',
    'escalation_contact_email',
    'requires_approval_below',
    'quality_flags',
    'source_quote',
    'schedule_type',
] as const

function validatePositionOrdering(
    min: number, fallback: number, ideal: number, max: number
): string | null {
    if (min < 1 || min > 10) return 'minimum_position must be 1-10'
    if (fallback < 1 || fallback > 10) return 'fallback_position must be 1-10'
    if (ideal < 1 || ideal > 10) return 'ideal_position must be 1-10'
    if (max < 1 || max > 10) return 'maximum_position must be 1-10'
    if (min > fallback) return 'minimum_position must be ≤ fallback_position'
    if (fallback > ideal) return 'fallback_position must be ≤ ideal_position'
    if (ideal > max) return 'ideal_position must be ≤ maximum_position'
    return null
}

// ============================================================================
// SECTION 2: PATCH — Update a single playbook rule
// ============================================================================

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ playbookId: string; ruleId: string }> }
) {
    try {
        const { playbookId, ruleId } = await params
        const body = await request.json()

        if (!playbookId || !ruleId) {
            return NextResponse.json(
                { error: 'playbookId and ruleId are required' },
                { status: 400 }
            )
        }

        // Build update object from allowed fields only
        const updates: Record<string, unknown> = {}
        for (const field of ALLOWED_FIELDS) {
            if (body[field] !== undefined) {
                updates[field] = body[field]
            }
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json(
                { error: 'No valid fields to update' },
                { status: 400 }
            )
        }

        const supabase = createServiceRoleClient()

        // If any position fields are being updated, validate ordering
        const positionFields = ['minimum_position', 'fallback_position', 'ideal_position', 'maximum_position']
        const hasPositionUpdate = positionFields.some(f => updates[f] !== undefined)

        if (hasPositionUpdate) {
            // Fetch current rule to merge with updates
            const { data: currentRule, error: fetchError } = await supabase
                .from('playbook_rules')
                .select('minimum_position, fallback_position, ideal_position, maximum_position')
                .eq('rule_id', ruleId)
                .eq('playbook_id', playbookId)
                .single()

            if (fetchError || !currentRule) {
                return NextResponse.json(
                    { error: 'Rule not found' },
                    { status: 404 }
                )
            }

            const merged = {
                minimum_position: (updates.minimum_position ?? currentRule.minimum_position) as number,
                fallback_position: (updates.fallback_position ?? currentRule.fallback_position) as number,
                ideal_position: (updates.ideal_position ?? currentRule.ideal_position) as number,
                maximum_position: (updates.maximum_position ?? currentRule.maximum_position) as number,
            }

            const validationError = validatePositionOrdering(
                merged.minimum_position,
                merged.fallback_position,
                merged.ideal_position,
                merged.maximum_position
            )

            if (validationError) {
                return NextResponse.json(
                    { error: validationError },
                    { status: 400 }
                )
            }
        }

        // If range_context is being updated, set source to 'manual'
        if (updates.range_context && typeof updates.range_context === 'object') {
            (updates.range_context as Record<string, unknown>).source = 'manual'
        }

        // Set updated_at timestamp
        updates.updated_at = new Date().toISOString()

        // Perform the update
        const { data, error } = await supabase
            .from('playbook_rules')
            .update(updates)
            .eq('rule_id', ruleId)
            .eq('playbook_id', playbookId)
            .select()
            .single()

        if (error) {
            console.error('Playbook rule update error:', error)
            return NextResponse.json(
                { error: 'Failed to update rule', details: error.message },
                { status: 500 }
            )
        }

        if (!data) {
            return NextResponse.json(
                { error: 'Rule not found' },
                { status: 404 }
            )
        }

        return NextResponse.json({ success: true, rule: data })

    } catch (error) {
        console.error('Playbook rule PATCH error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
