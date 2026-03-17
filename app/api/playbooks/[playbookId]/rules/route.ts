// ============================================================================
// FILE: app/api/playbooks/[playbookId]/rules/route.ts
// PURPOSE: POST endpoint for bulk-inserting playbook rules
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase'

function validatePositionOrdering(
    min: number, fallback: number, ideal: number, max: number
): string | null {
    if (min < 1 || min > 10) return 'minimum_position must be 1-10'
    if (fallback < 1 || fallback > 10) return 'fallback_position must be 1-10'
    if (ideal < 1 || ideal > 10) return 'ideal_position must be 1-10'
    if (max < 1 || max > 10) return 'maximum_position must be 1-10'
    if (min > fallback) return 'minimum_position must be <= fallback_position'
    if (fallback > ideal) return 'fallback_position must be <= ideal_position'
    if (ideal > max) return 'ideal_position must be <= maximum_position'
    return null
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ playbookId: string }> }
) {
    try {
        const { playbookId } = await params
        const body = await request.json()

        if (!playbookId) {
            return NextResponse.json(
                { error: 'playbookId is required' },
                { status: 400 }
            )
        }

        const { rules } = body
        if (!Array.isArray(rules) || rules.length === 0) {
            return NextResponse.json(
                { error: 'rules array is required and must not be empty' },
                { status: 400 }
            )
        }

        // Validate all rules before inserting
        for (let i = 0; i < rules.length; i++) {
            const rule = rules[i]
            if (!rule.clause_name || !rule.category) {
                return NextResponse.json(
                    { error: `Rule ${i + 1}: clause_name and category are required` },
                    { status: 400 }
                )
            }
            const posError = validatePositionOrdering(
                rule.minimum_position,
                rule.fallback_position,
                rule.ideal_position,
                rule.maximum_position
            )
            if (posError) {
                return NextResponse.json(
                    { error: `Rule ${i + 1} (${rule.clause_name}): ${posError}` },
                    { status: 400 }
                )
            }
        }

        const supabase = createServiceRoleClient()
        const now = new Date().toISOString()

        const insertRows = rules.map((rule: Record<string, unknown>, index: number) => ({
            playbook_id: playbookId,
            clause_name: rule.clause_name,
            clause_code: rule.clause_code || null,
            category: rule.category,
            ideal_position: rule.ideal_position,
            minimum_position: rule.minimum_position,
            maximum_position: rule.maximum_position,
            fallback_position: rule.fallback_position,
            is_deal_breaker: rule.is_deal_breaker ?? false,
            is_non_negotiable: rule.is_non_negotiable ?? false,
            requires_approval_below: rule.requires_approval_below ?? null,
            importance_level: rule.importance_level ?? 5,
            rationale: rule.rationale || null,
            negotiation_tips: rule.negotiation_tips || null,
            range_context: rule.range_context || null,
            display_order: rule.display_order ?? index + 1,
            is_active: true,
            schedule_type: rule.schedule_type || null,
            created_at: now,
            updated_at: now,
        }))

        const { data, error } = await supabase
            .from('playbook_rules')
            .insert(insertRows)
            .select()

        if (error) {
            console.error('Bulk rule insertion error:', error)
            return NextResponse.json(
                { error: 'Failed to insert rules', details: error.message },
                { status: 500 }
            )
        }

        // Update playbook rules_extracted count
        await supabase
            .from('company_playbooks')
            .update({
                rules_extracted: (data || []).length,
                updated_at: now,
            })
            .eq('playbook_id', playbookId)

        return NextResponse.json({
            success: true,
            count: (data || []).length,
            rules: data,
        })
    } catch (error) {
        console.error('Bulk rules POST error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
