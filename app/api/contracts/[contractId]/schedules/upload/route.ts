// ============================================================================
// FILE: app/api/contracts/[contractId]/schedules/upload/route.ts
// PURPOSE: Accept manually uploaded schedules (single, bulk, or auto-split)
//          and insert them into contract_schedules with detection_method='manual'
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// ============================================================================
// TYPES
// ============================================================================

interface UploadedSchedule {
    title: string
    content: string
    file_name?: string
    schedule_type?: string
}

interface AutoSplitRequest {
    mode: 'auto-split'
    document_text: string
    file_name?: string
}

interface ManualUploadRequest {
    mode: 'manual'
    schedules: UploadedSchedule[]
}

type UploadRequestBody = AutoSplitRequest | ManualUploadRequest

// ============================================================================
// AUTO-SPLIT: Detect "Schedule X" boundaries in a single document
// ============================================================================

function autoSplitSchedules(text: string): UploadedSchedule[] {
    // Match lines like:
    //   "Schedule 1 - Scope of Work"
    //   "SCHEDULE 2: Pricing"
    //   "Schedule 3"
    //   "SCHEDULE A — Insurance"
    const scheduleHeadingRegex = /^[\t ]*(?:SCHEDULE|Schedule)\s+([A-Za-z0-9]+)[\s]*[-–—:.]?\s*(.*)/gm

    const matches: { index: number; fullMatch: string; number: string; title: string }[] = []
    let match: RegExpExecArray | null

    while ((match = scheduleHeadingRegex.exec(text)) !== null) {
        matches.push({
            index: match.index,
            fullMatch: match[0].trim(),
            number: match[1],
            title: match[2]?.trim() || '',
        })
    }

    if (matches.length === 0) {
        // No schedule headings found — return the whole document as one schedule
        return [{
            title: 'Schedule 1',
            content: text.trim(),
            schedule_type: 'other',
        }]
    }

    const schedules: UploadedSchedule[] = []

    for (let i = 0; i < matches.length; i++) {
        const start = matches[i].index
        const end = i < matches.length - 1 ? matches[i + 1].index : text.length
        const content = text.slice(start, end).trim()

        const label = matches[i].title
            ? `Schedule ${matches[i].number} - ${matches[i].title}`
            : `Schedule ${matches[i].number}`

        schedules.push({
            title: label,
            content,
            schedule_type: guessScheduleType(label, content),
        })
    }

    return schedules
}

// ============================================================================
// SCHEDULE TYPE GUESSER (best-effort mapping from title to schedule_type)
// ============================================================================

function guessScheduleType(title: string, _content: string): string {
    const t = title.toLowerCase()
    if (/scope\s*(of\s*)?work|deliverable|sow/i.test(t)) return 'scope_of_work'
    if (/pric(e|ing)|rate\s*card|fee|charges/i.test(t)) return 'pricing'
    if (/service\s*level|sla|kpi/i.test(t)) return 'service_levels'
    if (/data\s*(processing|protection)|gdpr|dpa/i.test(t)) return 'data_processing'
    if (/governance|steering|escalation/i.test(t)) return 'governance'
    if (/exit|transition|handover/i.test(t)) return 'exit_transition'
    if (/insurance|indemnity|liability/i.test(t)) return 'insurance'
    if (/change\s*control|change\s*management/i.test(t)) return 'change_control'
    if (/disaster|recovery|business\s*continuity|dr\b/i.test(t)) return 'disaster_recovery'
    if (/security|infosec|cyber/i.test(t)) return 'security'
    if (/benchmark/i.test(t)) return 'benchmarking'
    if (/subcontract|approved\s*sub/i.test(t)) return 'subcontracting'
    return 'other'
}

// ============================================================================
// POST HANDLER
// ============================================================================

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ contractId: string }> }
) {
    const { contractId } = await params

    if (!contractId) {
        return NextResponse.json({ error: 'Contract ID required' }, { status: 400 })
    }

    try {
        const body = await request.json() as UploadRequestBody
        const supabase = createClient(supabaseUrl, supabaseKey)

        let schedulesToInsert: UploadedSchedule[] = []

        if (body.mode === 'auto-split') {
            // Auto-split a single large document into schedules
            if (!body.document_text || body.document_text.length < 50) {
                return NextResponse.json({ error: 'Document text too short to split' }, { status: 400 })
            }
            schedulesToInsert = autoSplitSchedules(body.document_text)
            console.log(`[schedule-upload] Auto-split: found ${schedulesToInsert.length} schedules`)
        } else {
            // Manual upload — one or more pre-extracted schedules
            if (!body.schedules || body.schedules.length === 0) {
                return NextResponse.json({ error: 'No schedules provided' }, { status: 400 })
            }
            schedulesToInsert = body.schedules
        }

        // Get the current max display order for this contract's schedules
        const { data: existingSchedules } = await supabase
            .from('contract_schedules')
            .select('schedule_id')
            .eq('contract_id', contractId)

        const startOrder = (existingSchedules?.length || 0) + 1

        // Build rows for insertion
        const rows = schedulesToInsert.map((s, i) => ({
            contract_id: contractId,
            schedule_type: s.schedule_type || 'other',
            schedule_label: s.title || `Schedule ${startOrder + i}`,
            detection_method: 'manual' as const,
            confidence_score: 1.0, // Manual upload = 100% confidence
            extracted_text: s.content || '',
            summary: s.content
                ? s.content.slice(0, 300) + (s.content.length > 300 ? '...' : '')
                : null,
            status: 'detected',
            start_position: null,
            end_position: null,
        }))

        const { data: inserted, error: insertErr } = await supabase
            .from('contract_schedules')
            .insert(rows)
            .select('schedule_id, schedule_type, schedule_label, confidence_score, status')

        if (insertErr) {
            console.error('[schedule-upload] Insert error:', insertErr)
            return NextResponse.json({ error: 'Failed to save schedules', detail: insertErr.message }, { status: 500 })
        }

        // Update the contract's schedule count
        const { data: allSchedules } = await supabase
            .from('contract_schedules')
            .select('schedule_id')
            .eq('contract_id', contractId)

        await supabase
            .from('uploaded_contracts')
            .update({
                schedule_count: allSchedules?.length || 0,
                schedule_detection_status: 'complete',
            })
            .eq('contract_id', contractId)

        console.log(`[schedule-upload] Inserted ${inserted?.length || 0} schedules for contract ${contractId}`)

        return NextResponse.json({
            success: true,
            schedules: inserted || [],
            count: inserted?.length || 0,
        })

    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error('[schedule-upload] Route error:', message)
        return NextResponse.json({ error: 'Upload failed', detail: message }, { status: 500 })
    }
}
