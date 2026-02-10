import { NextRequest, NextResponse } from 'next/server'

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'https://n8n.clarencetbh.com'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()

        // Validate required fields
        if (!body.contractId) {
            return NextResponse.json(
                { error: 'contractId is required' },
                { status: 400 }
            )
        }

        if (!['initiator', 'respondent'].includes(body.viewerRole)) {
            return NextResponse.json(
                { error: 'viewerRole must be initiator or respondent' },
                { status: 400 }
            )
        }

        // Call N8N workflow
        const response = await fetch(
            `${N8N_WEBHOOK_URL}/webhook/clarence-qc-context-builder`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            }
        )

        if (!response.ok) {
            const errorText = await response.text()
            console.error('N8N error:', errorText)
            return NextResponse.json(
                { error: 'Failed to build context' },
                { status: 500 }
            )
        }

        const context = await response.json()
        return NextResponse.json(context)

    } catch (error) {
        console.error('QC context builder error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}