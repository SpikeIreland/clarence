// ============================================================================
// FILE: app/api/playbooks/parse/route.ts
// PURPOSE: Server-side proxy for n8n SLM Section Mapper webhook
//          Avoids CORS issues from direct browser-to-n8n calls
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'

const N8N_WEBHOOK_BASE = process.env.N8N_WEBHOOK_BASE || 'https://spikeislandstudios.app.n8n.cloud/webhook'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()

        if (!body.playbook_id) {
            return NextResponse.json(
                { error: 'playbook_id is required' },
                { status: 400 }
            )
        }

        if (!body.extracted_text || body.extracted_text.length < 100) {
            return NextResponse.json(
                { error: 'extracted_text is required and must be at least 100 characters' },
                { status: 400 }
            )
        }

        // Forward to n8n Section Mapper webhook (server-side, no CORS)
        const n8nRes = await fetch(`${N8N_WEBHOOK_BASE}/slm-section-mapper`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                playbook_id: body.playbook_id,
                extracted_text: body.extracted_text,
            }),
        })

        if (!n8nRes.ok) {
            const errText = await n8nRes.text().catch(() => '')
            console.error('n8n slm-section-mapper error:', n8nRes.status, errText)
            return NextResponse.json(
                { error: 'Failed to start playbook analysis', detail: errText },
                { status: 502 }
            )
        }

        const data = await n8nRes.json().catch(() => ({}))
        return NextResponse.json({ success: true, ...data })
    } catch (e) {
        console.error('Parse proxy error:', e)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
