// ============================================================================
// CLARENCE System Observability - Event Logging API
// File: app/api/system-events/route.ts
// Version: 1.0
// Description: POST endpoint for logging events from frontend and N8N
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// SECTION 1: TYPE DEFINITIONS
// ============================================================================

interface EventLogRequest {
    // Required fields
    journeyType: string;
    stepName: string;
    status: 'started' | 'completed' | 'failed' | 'skipped';

    // Optional context
    sessionId?: string;
    userId?: string;
    traceId?: string;
    stepNumber?: number;
    stepCategory?: string;
    sourceSystem?: string;
    sourceIdentifier?: string;
    context?: Record<string, unknown>;
    errorMessage?: string;
    errorCode?: string;
    startedAt?: string;
    completedAt?: string;
    timestamp?: string;
}

interface EventLogResponse {
    success: boolean;
    eventId?: string;
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
// SECTION 3: VALIDATION
// ============================================================================

function validateRequest(body: EventLogRequest): { valid: boolean; error?: string } {
    // Required fields
    if (!body.journeyType) {
        return { valid: false, error: 'journeyType is required' };
    }
    if (!body.stepName) {
        return { valid: false, error: 'stepName is required' };
    }
    if (!body.status) {
        return { valid: false, error: 'status is required' };
    }

    // Status validation
    const validStatuses = ['started', 'completed', 'failed', 'skipped'];
    if (!validStatuses.includes(body.status)) {
        return { valid: false, error: `status must be one of: ${validStatuses.join(', ')}` };
    }

    // Length validations
    if (body.journeyType.length > 50) {
        return { valid: false, error: 'journeyType must be 50 characters or less' };
    }
    if (body.stepName.length > 100) {
        return { valid: false, error: 'stepName must be 100 characters or less' };
    }

    return { valid: true };
}

// ============================================================================
// SECTION 4: POST HANDLER - LOG EVENT
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse<EventLogResponse>> {
    try {
        // Parse request body
        const body: EventLogRequest = await request.json();

        // Validate request
        const validation = validateRequest(body);
        if (!validation.valid) {
            return NextResponse.json(
                { success: false, error: validation.error },
                { status: 400 }
            );
        }

        // Initialize Supabase
        const supabase = getSupabaseClient();

        // Build event record
        const now = new Date().toISOString();
        const eventRecord = {
            // Linking
            trace_id: body.traceId || body.sessionId || null,
            user_id: body.userId || null,
            session_id: body.sessionId || null,

            // Classification
            journey_type: body.journeyType,
            step_category: body.stepCategory || 'frontend',
            step_name: body.stepName,
            step_number: body.stepNumber || null,

            // Status
            status: body.status,
            error_message: body.errorMessage || null,
            error_code: body.errorCode || null,

            // Source
            source_system: body.sourceSystem || 'frontend',
            source_identifier: body.sourceIdentifier || null,

            // Context
            context: body.context || {},

            // Timing
            started_at: body.status === 'started' ? now : (body.startedAt || null),
            completed_at: body.status === 'completed' || body.status === 'failed' ? now : (body.completedAt || null),
            created_at: now
        };

        // Insert event into database
        const { data, error } = await supabase
            .from('system_events')
            .insert(eventRecord)
            .select('event_id')
            .single();

        if (error) {
            console.error('EventLogger API: Database error:', error);
            return NextResponse.json(
                { success: false, error: 'Failed to log event' },
                { status: 500 }
            );
        }

        // Return success
        return NextResponse.json({
            success: true,
            eventId: data.event_id
        });

    } catch (error) {
        console.error('EventLogger API: Unexpected error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// ============================================================================
// SECTION 5: GET HANDLER - RETRIEVE RECENT EVENTS
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '50');
        const sessionId = searchParams.get('sessionId');
        const journeyType = searchParams.get('journeyType');
        const status = searchParams.get('status');
        const sourceSystem = searchParams.get('sourceSystem');

        // Initialize Supabase
        const supabase = getSupabaseClient();

        // Build query
        let query = supabase
            .from('system_events')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(Math.min(limit, 500)); // Cap at 500

        // Apply filters
        if (sessionId) {
            query = query.eq('session_id', sessionId);
        }
        if (journeyType) {
            query = query.eq('journey_type', journeyType);
        }
        if (status) {
            query = query.eq('status', status);
        }
        if (sourceSystem) {
            query = query.eq('source_system', sourceSystem);
        }

        const { data, error } = await query;

        if (error) {
            console.error('EventLogger API: Query error:', error);
            return NextResponse.json(
                { success: false, error: 'Failed to retrieve events' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            events: data,
            count: data.length
        });

    } catch (error) {
        console.error('EventLogger API: Unexpected error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// ============================================================================
// END OF FILE
// ============================================================================