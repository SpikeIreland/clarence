import { NextRequest, NextResponse } from 'next/server'

const N8N_BASE = process.env.NEXT_PUBLIC_N8N_API_BASE || 'https://spikeislandstudios.app.n8n.cloud/webhook'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ contractId: string }> }
) {
    const { contractId } = await params

    if (!contractId) {
        return NextResponse.json({ error: 'Contract ID required' }, { status: 400 })
    }

    try {
        const response = await fetch(
            `${N8N_BASE}/get-uploaded-contract?contract_id=${contractId}`,
            { method: 'GET', headers: { 'Content-Type': 'application/json' } }
        )

        if (!response.ok) {
            const errorText = await response.text()
            console.error('N8N error:', errorText)
            return NextResponse.json({ error: 'Failed to fetch contract' }, { status: response.status })
        }

        const data = await response.json()
        return NextResponse.json(data)
    } catch (error) {
        console.error('Proxy error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}