// ============================================================================
// CLARENCE System Observability - Failed Events API
// File: app/api/system-events/failures/route.ts
// Version: 1.0
// Description: GET endpoint for retrieving failed events for alerting
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// SECTION 1: TYPE DEFINITIONS
// ============================================================================

interface FailedEvent {
    event_id: string;
    session_id: string | null;
    user_id: string | null;
    journey_type: string;
    step_name: string;
    error_message: string | null;
    error_code: string | null;
    source_system: string;
    source_identifier: string | null;
    context: Record<string, unknown>;
    created_at: string;
    time_ago: string;
}

interface FailureSummary {
    journey_type: string;
    failure_count: number;
    most_common_step: string;
    most_recent: string;
}

interface FailuresResponse {
    success: boolean;
    failures: FailedEvent[];
    summary: FailureSummary[];
    totalFailures: number;
    timeRange: string;
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
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

function getTimeRangeFilter(hours: number): string {
    const date = new Date();
    date.setHours(date.getHours() - hours);
    return date.toISOString();
}

// ============================================================================
// SECTION 4: GET HANDLER - RETRIEVE FAILED EVENTS
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse<FailuresResponse>> {
    try {
        const { searchParams } = new URL(request.url);

        // Parse query parameters
        const hours = parseInt(searchParams.get('hours') || '24');
        const limit = parseInt(searchParams.get('limit') || '100');
        const journeyType = searchParams.get('journeyType');
        const sessionId = searchParams.get('sessionId');

        // Calculate time filter
        const timeFilter = getTimeRangeFilter(hours);

        // Initialize Supabase
        const supabase = getSupabaseClient();

        // Build query for failed events
        let query = supabase
            .from('system_events')
            .select('event_id, session_id, user_id, journey_type, step_name, error_message, error_code, source_system, source_identifier, context, created_at')
            .eq('status', 'failed')
            .gte('created_at', timeFilter)
            .order('created_at', { ascending: false })
            .limit(Math.min(limit, 500));

        // Apply optional filters
        if (journeyType) {
            query = query.eq('journey_type', journeyType);
        }
        if (sessionId) {
            query = query.eq('session_id', sessionId);
        }

        const { data: failures, error } = await query;

        if (error) {
            console.error('Failures API: Query error:', error);
            return NextResponse.json(
                { success: false, failures: [], summary: [], totalFailures: 0, timeRange: `${hours}h`, error: 'Failed to retrieve failures' },
                { status: 500 }
            );
        }

        // Add time_ago to each failure
        const enrichedFailures: FailedEvent[] = (failures || []).map(f => ({
            ...f,
            time_ago: calculateTimeAgo(f.created_at)
        }));

        // Generate summary by journey type
        const summaryMap: Map<string, { count: number; steps: Map<string, number>; mostRecent: string }> = new Map();

        for (const failure of enrichedFailures) {
            if (!summaryMap.has(failure.journey_type)) {
                summaryMap.set(failure.journey_type, {
                    count: 0,
                    steps: new Map(),
                    mostRecent: failure.created_at
                });
            }

            const summary = summaryMap.get(failure.journey_type)!;
            summary.count++;
            summary.steps.set(failure.step_name, (summary.steps.get(failure.step_name) || 0) + 1);

            if (failure.created_at > summary.mostRecent) {
                summary.mostRecent = failure.created_at;
            }
        }

        // Convert summary map to array
        const summary: FailureSummary[] = Array.from(summaryMap.entries()).map(([journeyType, data]) => {
            // Find most common step
            let mostCommonStep = '';
            let maxCount = 0;
            for (const [step, count] of data.steps) {
                if (count > maxCount) {
                    maxCount = count;
                    mostCommonStep = step;
                }
            }

            return {
                journey_type: journeyType,
                failure_count: data.count,
                most_common_step: mostCommonStep,
                most_recent: data.mostRecent
            };
        }).sort((a, b) => b.failure_count - a.failure_count);

        return NextResponse.json({
            success: true,
            failures: enrichedFailures,
            summary,
            totalFailures: enrichedFailures.length,
            timeRange: `${hours}h`
        });

    } catch (error) {
        console.error('Failures API: Unexpected error:', error);
        return NextResponse.json(
            { success: false, failures: [], summary: [], totalFailures: 0, timeRange: '24h', error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// ============================================================================
// END OF FILE
// ============================================================================