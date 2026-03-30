import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const N8N_BASE = process.env.NEXT_PUBLIC_N8N_API_BASE || 'https://spikeislandstudios.app.n8n.cloud/webhook'

// GET: Fetch detected schedules for a contract + expected vs found comparison
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ contractId: string }> }
) {
    const { contractId } = await params

    if (!contractId) {
        return NextResponse.json({ error: 'Contract ID required' }, { status: 400 })
    }

    try {
        const supabase = createClient(supabaseUrl, supabaseKey)

        // Fetch detected schedules
        const { data: schedules, error: schedError } = await supabase
            .from('contract_schedules')
            .select('*')
            .eq('contract_id', contractId)
            .order('schedule_type', { ascending: true })

        if (schedError) {
            console.error('Error fetching schedules:', schedError)
            return NextResponse.json({ error: 'Failed to fetch schedules' }, { status: 500 })
        }

        // Fetch contract metadata for detection status
        const { data: contract, error: contractError } = await supabase
            .from('uploaded_contracts')
            .select('contract_id, contract_type_key, schedule_count, schedule_detection_status')
            .eq('contract_id', contractId)
            .single()

        if (contractError) {
            console.error('Error fetching contract:', contractError)
            return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
        }

        return NextResponse.json({
            schedules: schedules || [],
            contractTypeKey: contract.contract_type_key,
            scheduleCount: contract.schedule_count || 0,
            detectionStatus: contract.schedule_detection_status,
        })
    } catch (error) {
        console.error('Schedule fetch error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// POST: Trigger schedule detection via n8n webhook
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ contractId: string }> }
) {
    const { contractId } = await params

    if (!contractId) {
        return NextResponse.json({ error: 'Contract ID required' }, { status: 400 })
    }

    try {
        const body = await request.json().catch(() => ({}))
        const contractTypeKey = body.contractTypeKey || body.contract_type_key || null

        const response = await fetch(
            `${N8N_BASE}/detect-contract-schedules`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contract_id: contractId,
                    contract_type_key: contractTypeKey,
                }),
            }
        )

        if (!response.ok) {
            const errorText = await response.text()
            console.error('N8N schedule detection error:', errorText)
            return NextResponse.json(
                { error: 'Schedule detection failed' },
                { status: response.status }
            )
        }

        const data = await response.json()
        return NextResponse.json(data)
    } catch (error) {
        console.error('Schedule detection proxy error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
