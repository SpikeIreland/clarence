import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase'

// ============================================================================
// POST /api/qc/[token]/comment
// Insert a recipient comment. Token is the auth mechanism.
// ============================================================================

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    const { token } = await params
    if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

    const body = await request.json()
    const { commentText, quickContractId } = body

    if (!commentText?.trim()) {
        return NextResponse.json({ error: 'Comment text required' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    const { data: recipientData } = await supabase
        .from('qc_recipients')
        .select('recipient_id, quick_contract_id')
        .eq('access_token', token)
        .single()

    if (!recipientData) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const contractId = quickContractId || recipientData.quick_contract_id

    const { error: insertError } = await supabase
        .from('qc_comments')
        .insert({
            quick_contract_id: contractId,
            recipient_id: recipientData.recipient_id,
            comment_text: commentText.trim(),
            commenter_type: 'recipient',
        })

    if (insertError) {
        return NextResponse.json({ error: 'Failed to insert comment' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
}
