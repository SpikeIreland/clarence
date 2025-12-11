// ============================================================================
// CLARENCE System Observability - User Lookup API
// File: app/api/system-events/user/route.ts
// Version: 1.1 (Fixed)
// Description: Lookup user activity by user_id or email
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// SECTION 1: TYPE DEFINITIONS
// ============================================================================

interface UserSession {
    session_id: string;
    session_number: string | null;
    status: string;
    event_count: number;
    last_activity: string;
    journeys: string[];
}

interface UserActivity {
    user_id: string;
    email: string | null;
    first_name: string | null;
    last_name: string | null;
    company: string | null;
    total_sessions: number;
    total_events: number;
    first_seen: string | null;
    last_seen: string | null;
    sessions: UserSession[];
}

// ============================================================================
// SECTION 2: HELPER FUNCTIONS
// ============================================================================

function formatTimeAgo(dateString: string): string {
    const diff = Date.now() - new Date(dateString).getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} mins ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    return `${Math.floor(diff / 86400000)} days ago`;
}

// ============================================================================
// SECTION 3: GET HANDLER
// ============================================================================

export async function GET(request: NextRequest) {
    try {
        // Create Supabase client inside handler
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseKey) {
            return NextResponse.json(
                { success: false, error: 'Database configuration missing' },
                { status: 500 }
            );
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // ========================================================================
        // SECTION 3.1: Parse Query Parameter
        // Frontend sends: query=email:user@example.com or query=user_id:abc123
        // ========================================================================

        const searchParams = request.nextUrl.searchParams;
        const query = searchParams.get('query');

        if (!query) {
            return NextResponse.json(
                { success: false, error: 'Query parameter is required (format: email:user@example.com or user_id:abc123)' },
                { status: 400 }
            );
        }

        // Parse the query format
        const colonIndex = query.indexOf(':');
        if (colonIndex === -1) {
            return NextResponse.json(
                { success: false, error: 'Invalid query format. Use email:user@example.com or user_id:abc123' },
                { status: 400 }
            );
        }

        const searchType = query.substring(0, colonIndex).trim();
        const searchValue = query.substring(colonIndex + 1).trim();

        if (!searchType || !searchValue) {
            return NextResponse.json(
                { success: false, error: 'Invalid query format. Use email:user@example.com or user_id:abc123' },
                { status: 400 }
            );
        }

        // ========================================================================
        // SECTION 3.2: Find User
        // ========================================================================

        let userId: string | null = null;
        let userDetails: { email?: string; first_name?: string; last_name?: string; company?: string } = {};

        if (searchType === 'user_id') {
            userId = searchValue;

            // Try to get user details from users table
            const { data: userData } = await supabase
                .from('users')
                .select('email, first_name, last_name, company')
                .eq('user_id', userId)
                .single();

            if (userData) {
                userDetails = userData;
            }

        } else if (searchType === 'email') {
            // Look up user by email in users table
            const { data: userData } = await supabase
                .from('users')
                .select('user_id, email, first_name, last_name, company')
                .ilike('email', searchValue)
                .single();

            if (userData) {
                userId = userData.user_id;
                userDetails = {
                    email: userData.email,
                    first_name: userData.first_name,
                    last_name: userData.last_name,
                    company: userData.company
                };
            } else {
                // Try to find user_id from system_events context
                const { data: events } = await supabase
                    .from('system_events')
                    .select('user_id, context')
                    .not('user_id', 'is', null)
                    .limit(500);

                const matchingEvent = (events || []).find(event => {
                    if (event.context && typeof event.context === 'object') {
                        const ctx = event.context as Record<string, unknown>;
                        const ctxEmail = (ctx.email || ctx.userEmail || ctx.providerEmail || ctx.contactEmail || '') as string;
                        return ctxEmail.toLowerCase() === searchValue.toLowerCase();
                    }
                    return false;
                });

                if (matchingEvent) {
                    userId = matchingEvent.user_id;
                    userDetails.email = searchValue;
                }
            }

        } else {
            return NextResponse.json(
                { success: false, error: 'Invalid search type. Use email or user_id' },
                { status: 400 }
            );
        }

        // ========================================================================
        // SECTION 3.3: Handle No User Found
        // ========================================================================

        if (!userId) {
            return NextResponse.json({
                success: true,
                user: null,
                message: 'No user found with the provided criteria'
            });
        }

        // ========================================================================
        // SECTION 3.4: Get User's Events
        // ========================================================================

        const { data: userEvents, error: eventsError } = await supabase
            .from('system_events')
            .select('event_id, session_id, journey_type, step_name, status, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(500);

        if (eventsError) {
            console.error('Events query error:', eventsError);
        }

        // ========================================================================
        // SECTION 3.5: Get Unique Sessions
        // ========================================================================

        const sessionIds = [...new Set((userEvents || []).map(e => e.session_id).filter(Boolean))];

        // Get session details from contract_sessions
        const sessionsWithDetails: UserSession[] = [];

        for (const sessionId of sessionIds.slice(0, 20)) {
            if (!sessionId) continue;

            // Get session info
            const { data: sessionData } = await supabase
                .from('contract_sessions')
                .select('session_id, session_number, status')
                .eq('session_id', sessionId)
                .single();

            // Get events for this session
            const sessionEvents = (userEvents || []).filter(e => e.session_id === sessionId);
            const journeyTypes = [...new Set(sessionEvents.map(e => e.journey_type))];
            const lastEvent = sessionEvents[0]; // Already sorted desc

            sessionsWithDetails.push({
                session_id: sessionId,
                session_number: sessionData?.session_number || null,
                status: sessionData?.status || 'unknown',
                event_count: sessionEvents.length,
                last_activity: lastEvent?.created_at || '',
                journeys: journeyTypes
            });
        }

        // Sort by last activity
        sessionsWithDetails.sort((a, b) =>
            new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime()
        );

        // ========================================================================
        // SECTION 3.6: Build Response
        // ========================================================================

        const totalEvents = userEvents?.length || 0;
        const firstEvent = userEvents?.[userEvents.length - 1];
        const lastEvent = userEvents?.[0];

        const userActivity: UserActivity = {
            user_id: userId,
            email: userDetails.email || null,
            first_name: userDetails.first_name || null,
            last_name: userDetails.last_name || null,
            company: userDetails.company || null,
            total_sessions: sessionIds.length,
            total_events: totalEvents,
            first_seen: firstEvent?.created_at || null,
            last_seen: lastEvent?.created_at || null,
            sessions: sessionsWithDetails
        };

        return NextResponse.json({
            success: true,
            user: userActivity
        });

    } catch (error) {
        console.error('User lookup error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// ============================================================================
// END OF FILE
// ============================================================================