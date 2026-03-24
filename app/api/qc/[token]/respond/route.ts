import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase'

// ============================================================================
// POST /api/qc/[token]/respond
// Record recipient accept/decline response. Token is the auth mechanism.
// ============================================================================

export async function POST(
    request: NextRequest,
    { params }: { params: { token: string } }
) {
    const { token } = params
    if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

    const body = await request.json()
    const { responseType, responseMessage, declineReason } = body

    if (!responseType || !['accepted', 'declined'].includes(responseType)) {
        return NextResponse.json({ error: 'Invalid responseType' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    const { data: recipientData } = await supabase
        .from('qc_recipients')
        .select('recipient_id, quick_contract_id')
        .eq('access_token', token)
        .single()

    if (!recipientData) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const now = new Date().toISOString()

    const { error: updateError } = await supabase
        .from('qc_recipients')
        .update({
            status: responseType,
            response_type: responseType,
            response_message: responseMessage || null,
            decline_reason: responseType === 'declined' ? declineReason || null : null,
            responded_at: now,
            updated_at: now,
        })
        .eq('recipient_id', recipientData.recipient_id)

    if (updateError) {
        return NextResponse.json({ error: 'Failed to update recipient' }, { status: 500 })
    }

    await supabase
        .from('quick_contracts')
        .update({ status: responseType, completed_at: now, updated_at: now })
        .eq('quick_contract_id', recipientData.quick_contract_id)

    await supabase
        .from('qc_audit_log')
        .insert({
            quick_contract_id: recipientData.quick_contract_id,
            recipient_id: recipientData.recipient_id,
            event_type: responseType,
            event_description: responseType === 'accepted'
                ? 'Recipient accepted the contract'
                : 'Recipient declined the contract',
            event_data: {
                responseMessage: responseMessage || null,
                declineReason: responseType === 'declined' ? declineReason || null : null,
            },
        })

    return NextResponse.json({ ok: true })
}
