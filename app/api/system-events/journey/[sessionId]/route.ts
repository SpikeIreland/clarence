// ============================================================================
// CLARENCE System Observability - Journey Events API
// File: app/api/system-events/journey/[sessionId]/route.ts
// Version: 1.0
// Description: GET endpoint for retrieving all events for a session
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// SECTION 1: TYPE DEFINITIONS
// ============================================================================

interface SystemEvent {
    event_id: string;
    trace_id: string | null;
    user_id: string | null;
    session_id: string | null;
    journey_type: string;
    step_category: string;
    step_name: string;
    step_number: number | null;
    status: string;
    error_message: string | null;
    error_code: string | null;
    source_system: string;
    source_identifier: string | null;
    context: Record<string, unknown>;
    started_at: string | null;
    completed_at: string | null;
    duration_ms: number | null;
    created_at: string;
}

interface JourneyProgress {
    journeyType: string;
    totalSteps: number;
    completedSteps: number;
    failedSteps: number;
    inProgressSteps: number;
    currentStep: number;
    percentComplete: number;
    lastActivity: string;
    events: SystemEvent[];
}

interface JourneyResponse {
    success: boolean;
    sessionId: string;
    journeys: JourneyProgress[];
    totalEvents: number;
    error?: string;
}

// ============================================================================
// SECTION 2: SUPABASE CLIENT
// ============================================================================

function getSupabaseClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase environment variables');
    }

    return createClient(supabaseUrl, supabaseKey);
}

// ============================================================================
// SECTION 3: GET HANDLER - RETRIEVE JOURNEY EVENTS
// ============================================================================

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> }
): Promise<NextResponse<JourneyResponse>> {
    try {
        // Await the params (Next.js 15+ requirement)
        const { sessionId } = await params;

        if (!sessionId) {
            return NextResponse.json(
                { success: false, sessionId: '', journeys: [], totalEvents: 0, error: 'sessionId is required' },
                { status: 400 }
            );
        }

        // Initialize Supabase
        const supabase = getSupabaseClient();

        // Fetch all events for this session
        const { data: events, error: eventsError } = await supabase
            .from('system_events')
            .select('*')
            .eq('session_id', sessionId)
            .order('journey_type', { ascending: true })
            .order('step_number', { ascending: true })
            .order('created_at', { ascending: true });

        if (eventsError) {
            console.error('Journey API: Query error:', eventsError);
            return NextResponse.json(
                { success: false, sessionId, journeys: [], totalEvents: 0, error: 'Failed to retrieve events' },
                { status: 500 }
            );
        }

        // Fetch journey definitions for progress calculation
        const { data: definitions } = await supabase
            .from('journey_definitions')
            .select('journey_type, step_number, step_name, is_required')
            .order('journey_type')
            .order('step_number');

        // Group events by journey type
        const journeyGroups: Map<string, SystemEvent[]> = new Map();
        for (const event of events || []) {
            const journeyType = event.journey_type;
            if (!journeyGroups.has(journeyType)) {
                journeyGroups.set(journeyType, []);
            }
            journeyGroups.get(journeyType)!.push(event);
        }

        // Build journey progress objects
        const journeys: JourneyProgress[] = [];

        for (const [journeyType, journeyEvents] of journeyGroups) {
            // Get expected steps for this journey
            const expectedSteps = definitions?.filter(d => d.journey_type === journeyType) || [];
            const requiredSteps = expectedSteps.filter(s => s.is_required);

            // Calculate progress
            const completedSteps = journeyEvents.filter(e => e.status === 'completed').length;
            const failedSteps = journeyEvents.filter(e => e.status === 'failed').length;
            const inProgressSteps = journeyEvents.filter(e => e.status === 'started' && !journeyEvents.some(
                other => other.step_name === e.step_name && (other.status === 'completed' || other.status === 'failed')
            )).length;

            const maxStepNumber = Math.max(
                ...journeyEvents.map(e => e.step_number || 0),
                0
            );

            const totalExpectedSteps = requiredSteps.length || journeyEvents.length;
            const percentComplete = totalExpectedSteps > 0
                ? Math.round((completedSteps / totalExpectedSteps) * 100)
                : 0;

            const lastActivity = journeyEvents.length > 0
                ? journeyEvents[journeyEvents.length - 1].created_at
                : '';

            journeys.push({
                journeyType,
                totalSteps: totalExpectedSteps,
                completedSteps,
                failedSteps,
                inProgressSteps,
                currentStep: maxStepNumber,
                percentComplete: Math.min(percentComplete, 100),
                lastActivity,
                events: journeyEvents
            });
        }

        // Sort journeys by typical order
        const journeyOrder = [
            'customer_onboarding',
            'contract_session_creation',
            'customer_requirements',
            'customer_questionnaire',
            'provider_invitation',
            'provider_onboarding',
            'provider_questionnaire',
            'leverage_calculation',
            'contract_studio',
            'clause_negotiation',
            'clarence_chat',
            'tradeoff_analysis',
            'draft_generation'
        ];

        journeys.sort((a, b) => {
            const orderA = journeyOrder.indexOf(a.journeyType);
            const orderB = journeyOrder.indexOf(b.journeyType);
            return (orderA === -1 ? 999 : orderA) - (orderB === -1 ? 999 : orderB);
        });

        return NextResponse.json({
            success: true,
            sessionId,
            journeys,
            totalEvents: events?.length || 0
        });

    } catch (error) {
        console.error('Journey API: Unexpected error:', error);
        return NextResponse.json(
            { success: false, sessionId: '', journeys: [], totalEvents: 0, error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// ============================================================================
// END OF FILE
// ============================================================================