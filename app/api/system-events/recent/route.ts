// ============================================================================
// CLARENCE System Observability - Recent Events API
// File: app/api/system-events/recent/route.ts
// Version: 1.0
// Description: GET endpoint for retrieving recent events for monitoring dashboard
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// SECTION 1: TYPE DEFINITIONS
// ============================================================================

interface RecentEvent {
    event_id: string;
    session_id: string | null;
    journey_type: string;
    step_name: string;
    step_number: number | null;
    status: string;
    source_system: string;
    duration_ms: number | null;
    error_message: string | null;
    created_at: string;
    time_ago: string;
}

interface SystemStats {
    total_events_1h: number;
    total_events_24h: number;
    failures_1h: number;
    failures_24h: number;
    active_sessions_1h: number;
    events_by_source: Record<string, number>;
    events_by_journey: Record<string, number>;
    avg_duration_ms: number | null;
}

interface RecentEventsResponse {
    success: boolean;
    events: RecentEvent[];
    stats: SystemStats;
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
// SECTION 3: HELPER FUNCTIONS
// ============================================================================

function calculateTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);

    if (diffSecs < 10) return 'just now';
    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
}

// ============================================================================
// SECTION 4: GET HANDLER - RETRIEVE RECENT EVENTS
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse<RecentEventsResponse>> {
    try {
        const { searchParams } = new URL(request.url);

        // Parse query parameters
        const limit = parseInt(searchParams.get('limit') || '50');
        const sourceSystem = searchParams.get('source');
        const journeyType = searchParams.get('journey');
        const statusFilter = searchParams.get('status');

        // Initialize Supabase
        const supabase = getSupabaseClient();

        // Calculate time boundaries
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

        // Build query for recent events
        let query = supabase
            .from('system_events')
            .select('event_id, session_id, journey_type, step_name, step_number, status, source_system, duration_ms, error_message, created_at')
            .order('created_at', { ascending: false })
            .limit(Math.min(limit, 200));

        // Apply optional filters
        if (sourceSystem) {
            query = query.eq('source_system', sourceSystem);
        }
        if (journeyType) {
            query = query.eq('journey_type', journeyType);
        }
        if (statusFilter) {
            query = query.eq('status', statusFilter);
        }

        const { data: events, error: eventsError } = await query;

        if (eventsError) {
            console.error('Recent Events API: Query error:', eventsError);
            return NextResponse.json(
                {
                    success: false,
                    events: [],
                    stats: getEmptyStats(),
                    error: 'Failed to retrieve events'
                },
                { status: 500 }
            );
        }

        // Add time_ago to each event
        const enrichedEvents: RecentEvent[] = (events || []).map(e => ({
            ...e,
            time_ago: calculateTimeAgo(e.created_at)
        }));

        // Get stats - 1 hour
        const { data: stats1h } = await supabase
            .from('system_events')
            .select('event_id, status, source_system, journey_type, session_id, duration_ms')
            .gte('created_at', oneHourAgo);

        // Get stats - 24 hours
        const { data: stats24h } = await supabase
            .from('system_events')
            .select('event_id, status')
            .gte('created_at', oneDayAgo);

        // Calculate statistics
        const stats1hData = stats1h || [];
        const stats24hData = stats24h || [];

        const eventsBySource: Record<string, number> = {};
        const eventsByJourney: Record<string, number> = {};
        const uniqueSessions = new Set<string>();
        let totalDuration = 0;
        let durationCount = 0;

        for (const event of stats1hData) {
            // Source breakdown
            eventsBySource[event.source_system] = (eventsBySource[event.source_system] || 0) + 1;

            // Journey breakdown
            eventsByJourney[event.journey_type] = (eventsByJourney[event.journey_type] || 0) + 1;

            // Unique sessions
            if (event.session_id) {
                uniqueSessions.add(event.session_id);
            }

            // Duration average
            if (event.duration_ms !== null) {
                totalDuration += event.duration_ms;
                durationCount++;
            }
        }

        const stats: SystemStats = {
            total_events_1h: stats1hData.length,
            total_events_24h: stats24hData.length,
            failures_1h: stats1hData.filter(e => e.status === 'failed').length,
            failures_24h: stats24hData.filter(e => e.status === 'failed').length,
            active_sessions_1h: uniqueSessions.size,
            events_by_source: eventsBySource,
            events_by_journey: eventsByJourney,
            avg_duration_ms: durationCount > 0 ? Math.round(totalDuration / durationCount) : null
        };

        return NextResponse.json({
            success: true,
            events: enrichedEvents,
            stats
        });

    } catch (error) {
        console.error('Recent Events API: Unexpected error:', error);
        return NextResponse.json(
            {
                success: false,
                events: [],
                stats: getEmptyStats(),
                error: 'Internal server error'
            },
            { status: 500 }
        );
    }
}

// ============================================================================
// SECTION 5: HELPER - EMPTY STATS
// ============================================================================

function getEmptyStats(): SystemStats {
    return {
        total_events_1h: 0,
        total_events_24h: 0,
        failures_1h: 0,
        failures_24h: 0,
        active_sessions_1h: 0,
        events_by_source: {},
        events_by_journey: {},
        avg_duration_ms: null
    };
}

// ============================================================================
// END OF FILE
// ============================================================================