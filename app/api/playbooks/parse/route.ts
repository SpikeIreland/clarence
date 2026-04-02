// ============================================================================
// FILE: app/api/playbooks/parse/route.ts
// PURPOSE: Server-side proxy for n8n SLM Section Mapper webhook
//          Avoids CORS issues from direct browser-to-n8n calls
//          Uses fire-and-forget pattern — the frontend polls Supabase
//          for completion, so we don't need to wait for n8n's response.
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

        // Fire-and-forget: send to n8n but don't await the full response.
        // The SLM pipeline can take several minutes for large contracts,
        // which exceeds Cloudflare's ~100s timeout. The frontend polls
        // Supabase for status updates, so we just need to confirm the
        // webhook accepted the request.
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 15000) // 15s is plenty for n8n to accept

        try {
            const n8nRes = await fetch(`${N8N_WEBHOOK_BASE}/slm-section-mapper`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    playbook_id: body.playbook_id,
                    extracted_text: body.extracted_text,
                }),
                signal: controller.signal,
            })

            clearTimeout(timeoutId)

            if (!n8nRes.ok) {
                const errText = await n8nRes.text().catch(() => '')
                console.error('n8n slm-section-mapper error:', n8nRes.status, errText)
                return NextResponse.json(
                    { error: 'Failed to start playbook analysis', detail: errText },
                    { status: 502 }
                )
            }

            // If n8n responded quickly (e.g. lightweight playbooks), return the data
            const data = await n8nRes.json().catch(() => ({}))
            return NextResponse.json({ success: true, ...data })
        } catch (abortErr: unknown) {
            clearTimeout(timeoutId)

            // AbortError means n8n accepted the request but is still processing.
            // This is expected for large contracts — the webhook is running,
            // and the frontend will pick up completion via Supabase polling.
            if (abortErr instanceof Error && abortErr.name === 'AbortError') {
                console.log(`n8n webhook accepted playbook ${body.playbook_id} — processing async`)
                return NextResponse.json({
                    success: true,
                    async: true,
                    message: 'Playbook analysis started. Polling for completion.',
                })
            }
            throw abortErr
        }
    } catch (e) {
        console.error('Parse proxy error:', e)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
