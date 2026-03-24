import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase'

// ============================================================================
// GET /api/qc/[token]
// Public endpoint — no auth required. Token is the authentication mechanism.
// Uses service role client to bypass RLS entirely.
// ============================================================================

export async function GET(
    request: NextRequest,
    { params }: { params: { token: string } }
) {
    const { token } = params

    if (!token) {
        return NextResponse.json({ error: 'Token required' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    // 1. Find recipient by access token
    const { data: recipientData, error: recipientError } = await supabase
        .from('qc_recipients')
        .select('*')
        .eq('access_token', token)
        .single()

    if (recipientError || !recipientData) {
        return NextResponse.json({ error: 'Recipient not found' }, { status: 404 })
    }

    // 2. Validate token expiry
    if (recipientData.access_token_expires_at) {
        if (new Date(recipientData.access_token_expires_at) < new Date()) {
            return NextResponse.json({ error: 'Token expired' }, { status: 410 })
        }
    }

    // 3. Load contract
    const { data: contractData, error: contractError } = await supabase
        .from('quick_contracts')
        .select('*')
        .eq('quick_contract_id', recipientData.quick_contract_id)
        .single()

    if (contractError || !contractData) {
        return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }

    // 4. Content fallback — load from uploaded_contracts if needed
    let documentContent = contractData.document_content || null
    let clauseCount = 0
    const sourceContractId = contractData.source_contract_id || null

    if (sourceContractId) {
        if (!documentContent) {
            const { data: sourceContract } = await supabase
                .from('uploaded_contracts')
                .select('extracted_text')
                .eq('contract_id', sourceContractId)
                .single()

            if (sourceContract?.extracted_text) {
                documentContent = sourceContract.extracted_text
            }
        }

        const { count } = await supabase
            .from('uploaded_contract_clauses')
            .select('clause_id', { count: 'exact', head: true })
            .eq('contract_id', sourceContractId)
            .eq('is_header', false)

        clauseCount = count || 0
    }

    return NextResponse.json({
        recipient: recipientData,
        contract: { ...contractData, document_content: documentContent },
        clauseCount,
    })
}

// ============================================================================
// POST /api/qc/[token]/view — record that recipient viewed the contract
// Called separately after successful load so it doesn't block the page render
// ============================================================================

export async function POST(
    request: NextRequest,
    { params }: { params: { token: string } }
) {
    const { token } = params
    if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

    const supabase = createServiceRoleClient()

    const { data: recipientData } = await supabase
        .from('qc_recipients')
        .select('recipient_id, quick_contract_id, view_count, first_viewed_at')
        .eq('access_token', token)
        .single()

    if (!recipientData) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const now = new Date().toISOString()
    const isFirstView = !recipientData.first_viewed_at

    await supabase
        .from('qc_recipients')
        .update({
            view_count: (recipientData.view_count || 0) + 1,
            last_viewed_at: now,
            updated_at: now,
            ...(isFirstView ? { first_viewed_at: now, status: 'viewed' } : {}),
        })
        .eq('recipient_id', recipientData.recipient_id)

    if (isFirstView) {
        await supabase
            .from('quick_contracts')
            .update({ status: 'viewed', updated_at: now })
            .eq('quick_contract_id', recipientData.quick_contract_id)
    }

    await supabase
        .from('qc_audit_log')
        .insert({
            quick_contract_id: recipientData.quick_contract_id,
            recipient_id: recipientData.recipient_id,
            event_type: 'viewed',
            event_description: 'Recipient viewed the contract',
            event_data: { viewCount: (recipientData.view_count || 0) + 1 },
        })

    return NextResponse.json({ ok: true })
}
