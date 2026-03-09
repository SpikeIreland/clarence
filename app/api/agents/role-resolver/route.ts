// ============================================================================
// FILE: app/api/agents/role-resolver/route.ts
// PURPOSE: API endpoint for the Role Resolver agent
// PATTERN: Follows existing /api/n8n/* route conventions
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { resolveRoles, type RoleResolverInput } from '@/lib/agents/role-resolver'


// ============================================================================
// SECTION 1: POST HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
    try {
        const body: RoleResolverInput = await request.json()

        if (!body.sessionId) {
            return NextResponse.json(
                { error: 'sessionId is required', success: false },
                { status: 400 }
            )
        }

        console.log(`[RoleResolver API] Resolving roles for session ${body.sessionId}`)
        console.log(`  contractTypeKey: ${body.contractTypeKey || 'NOT SET'}`)
        console.log(`  initiatorPartyRole: ${body.initiatorPartyRole || 'NOT SET'}`)
        console.log(`  viewerRole: ${body.viewerRole || 'NOT SET'}`)

        const roleContext = await resolveRoles(body)

        console.log(`[RoleResolver API] Resolved: ${roleContext.userRoleLabel} vs ${roleContext.counterpartyRoleLabel}`)
        console.log(`  resolvedBy: ${roleContext.resolvedBy}, confidence: ${roleContext.confidence}`)

        return NextResponse.json({
            success: true,
            roleContext,
        })
    } catch (error) {
        console.error('[RoleResolver API] Error:', error)
        return NextResponse.json(
            {
                error: 'Internal server error',
                success: false,
            },
            { status: 500 }
        )
    }
}


// ============================================================================
// SECTION 2: OPTIONS HANDLER (CORS)
// ============================================================================

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    })
}
