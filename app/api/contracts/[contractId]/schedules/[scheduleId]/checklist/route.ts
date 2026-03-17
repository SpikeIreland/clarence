import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

const N8N_BASE = process.env.NEXT_PUBLIC_N8N_API_BASE || 'https://spikeislandstudios.app.n8n.cloud/webhook'

// GET: Fetch checklist results for a schedule
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ contractId: string; scheduleId: string }> }
) {
    const { contractId, scheduleId } = await params

    if (!contractId || !scheduleId) {
        return NextResponse.json({ error: 'Contract ID and Schedule ID required' }, { status: 400 })
    }

    try {
        const supabase = createClient()

        // Fetch checklist results
        const { data: results, error: resultsError } = await supabase
            .from('contract_schedule_checklist')
            .select('*')
            .eq('contract_id', contractId)
            .eq('schedule_id', scheduleId)
            .order('created_at', { ascending: true })

        if (resultsError) {
            console.error('Error fetching checklist results:', resultsError)
            return NextResponse.json({ error: 'Failed to fetch checklist' }, { status: 500 })
        }

        // Fetch schedule metadata for checklist status
        const { data: schedule, error: schedError } = await supabase
            .from('contract_schedules')
            .select('schedule_id, schedule_type, schedule_label, checklist_status, checklist_score')
            .eq('schedule_id', scheduleId)
            .single()

        if (schedError) {
            console.error('Error fetching schedule:', schedError)
            return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
        }

        return NextResponse.json({
            results: results || [],
            scheduleType: schedule.schedule_type,
            scheduleLabel: schedule.schedule_label,
            checklistStatus: schedule.checklist_status,
            checklistScore: schedule.checklist_score,
        })
    } catch (error) {
        console.error('Checklist fetch error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// POST: Trigger checklist completeness check via n8n
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ contractId: string; scheduleId: string }> }
) {
    const { contractId, scheduleId } = await params

    if (!contractId || !scheduleId) {
        return NextResponse.json({ error: 'Contract ID and Schedule ID required' }, { status: 400 })
    }

    try {
        // Mark as processing
        const supabase = createClient()
        await supabase
            .from('contract_schedules')
            .update({ checklist_status: 'processing' })
            .eq('schedule_id', scheduleId)

        const response = await fetch(
            `${N8N_BASE}/check-schedule-completeness`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contract_id: contractId,
                    schedule_id: scheduleId,
                }),
            }
        )

        if (!response.ok) {
            const errorText = await response.text()
            console.error('N8N checklist error:', errorText)

            // Mark as failed
            await supabase
                .from('contract_schedules')
                .update({ checklist_status: 'failed' })
                .eq('schedule_id', scheduleId)

            return NextResponse.json(
                { error: 'Schedule checklist check failed' },
                { status: response.status }
            )
        }

        const data = await response.json()
        return NextResponse.json(data)
    } catch (error) {
        console.error('Checklist proxy error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// PATCH: Manual override of a checklist result
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ contractId: string; scheduleId: string }> }
) {
    const { contractId, scheduleId } = await params

    try {
        const body = await request.json()
        const { resultId, manualOverride, notes } = body

        if (!resultId) {
            return NextResponse.json({ error: 'resultId is required' }, { status: 400 })
        }

        const supabase = createClient()

        const updateFields: Record<string, unknown> = { updated_at: new Date().toISOString() }
        if (manualOverride !== undefined) updateFields.manual_override = manualOverride
        if (notes !== undefined) updateFields.notes = notes

        const { data, error } = await supabase
            .from('contract_schedule_checklist')
            .update(updateFields)
            .eq('result_id', resultId)
            .eq('contract_id', contractId)
            .eq('schedule_id', scheduleId)
            .select()
            .single()

        if (error) {
            console.error('Checklist update error:', error)
            return NextResponse.json({ error: 'Failed to update checklist item' }, { status: 500 })
        }

        return NextResponse.json({ result: data })
    } catch (error) {
        console.error('Checklist PATCH error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
