// ============================================================================
// FILE: app/api/n8n/recertify-contract/route.ts
// PURPOSE: Re-run CLARENCE certification on all clauses for a contract
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const CERTIFY_WEBHOOK = 'https://spikeislandstudios.app.n8n.cloud/webhook/certify-next-clause'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { contractId, contractTypeKey, initiatorPartyRole, roleContext } = body

        if (!contractId) {
            return NextResponse.json(
                { error: 'contractId is required' },
                { status: 400 }
            )
        }

        // Use service-role client to bypass RLS for this admin operation
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        // Reset all non-header clauses to pending
        const { error: resetError, count } = await supabase
            .from('uploaded_contract_clauses')
            .update({
                status: 'pending',
                clarence_certified: false,
                clarence_assessment: null,
                clarence_summary: null,
                clarence_flags: null,
            })
            .eq('contract_id', contractId)
            .eq('is_header', false)

        if (resetError) {
            console.error('[recertify] Reset error:', resetError)
            return NextResponse.json(
                { error: 'Failed to reset clauses for re-certification' },
                { status: 500 }
            )
        }

        // Trigger the certification webhook with context
        const webhookResponse = await fetch(CERTIFY_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contract_id: contractId,
                contract_type_key: contractTypeKey || null,
                initiator_party_role: initiatorPartyRole || null,
                roleContext: roleContext || null,
            })
        })

        if (!webhookResponse.ok) {
            return NextResponse.json(
                { error: 'Certification webhook failed to start' },
                { status: 502 }
            )
        }

        return NextResponse.json({
            success: true,
            clausesReset: count || 0,
            message: 'Re-certification started. Clauses will be re-analysed with full position scale context.'
        })

    } catch (error) {
        console.error('[recertify] Error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
