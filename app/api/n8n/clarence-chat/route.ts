// ============================================================================
// SECTION 1: IMPORTS AND TYPES
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'

interface ClarenceChatRequest {
    message: string
    contractId?: string
    clauseId?: string
    clauseName?: string
    clauseCategory?: string
    context?: string
}

// ============================================================================
// SECTION 2: N8N WEBHOOK CONFIGURATION
// ============================================================================

const N8N_WEBHOOK_URL = process.env.N8N_CLARENCE_QC_CHAT_WEBHOOK
    || 'https://spikeislandstudios.app.n8n.cloud/webhook/clarence-qc-chat'

// ============================================================================
// SECTION 3: POST HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
    try {
        const body: ClarenceChatRequest = await request.json()

        if (!body.message) {
            return NextResponse.json(
                { error: 'Message is required' },
                { status: 400 }
            )
        }

        // Call N8N webhook
        const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: body.message,
                contractId: body.contractId || null,
                clauseId: body.clauseId || null,
                clauseName: body.clauseName || null,
                clauseCategory: body.clauseCategory || null,
                context: body.context || 'quick_contract_studio'
            })
        })

        if (!n8nResponse.ok) {
            console.error('N8N webhook error:', n8nResponse.status)
            return NextResponse.json(
                { error: 'Failed to get response from CLARENCE' },
                { status: 502 }
            )
        }

        const data = await n8nResponse.json()

        return NextResponse.json({
            response: data.response || data.message || data.text || '',
            success: true
        })

    } catch (error) {
        console.error('Clarence chat API error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

// ============================================================================
// SECTION 4: OPTIONS HANDLER (CORS)
// ============================================================================

export async function OPTIONS() {
    return NextResponse.json({}, { status: 200 })
}