// ============================================================================
// FILE: app/api/contracts/[contractId]/schedules/[scheduleId]/route.ts
// PURPOSE: Individual schedule operations — DELETE
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// DELETE: Remove a schedule from a contract
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ contractId: string; scheduleId: string }> }
) {
    const { contractId, scheduleId } = await params

    if (!contractId || !scheduleId) {
        return NextResponse.json({ error: 'Contract ID and Schedule ID required' }, { status: 400 })
    }

    try {
        const supabase = createClient(supabaseUrl, supabaseKey)

        // Delete associated checklist results first
        await supabase
            .from('contract_schedule_checklist')
            .delete()
            .eq('schedule_id', scheduleId)

        // Delete the schedule
        const { error } = await supabase
            .from('contract_schedules')
            .delete()
            .eq('schedule_id', scheduleId)
            .eq('contract_id', contractId)

        if (error) {
            console.error('[schedule-delete] Error:', error)
            return NextResponse.json({ error: 'Failed to delete schedule' }, { status: 500 })
        }

        // Update the contract's schedule count
        const { data: remaining } = await supabase
            .from('contract_schedules')
            .select('schedule_id')
            .eq('contract_id', contractId)

        await supabase
            .from('uploaded_contracts')
            .update({ schedule_count: remaining?.length || 0 })
            .eq('contract_id', contractId)

        console.log(`[schedule-delete] Deleted schedule ${scheduleId} from contract ${contractId}`)

        return NextResponse.json({ success: true, remainingCount: remaining?.length || 0 })
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error('[schedule-delete] Route error:', message)
        return NextResponse.json({ error: 'Delete failed', detail: message }, { status: 500 })
    }
}
