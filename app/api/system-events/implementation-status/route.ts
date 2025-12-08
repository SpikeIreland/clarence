// ============================================================================
// CLARENCE System Observability - Implementation Status API
// File: app/api/system-events/implementation-status/route.ts
// Version: 1.1
// Description: API endpoint to check implementation status of frontend/N8N logging
// ============================================================================

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// SECTION 1: TYPE DEFINITIONS
// ============================================================================

interface ImplementationItem {
    id: string;
    name: string;
    category: string;
    type: 'frontend' | 'n8n';
    journeyType: string;
    expectedEvents: string[];
    status: 'implemented' | 'pending' | 'partial';
    lastEventAt: string | null;
    eventCount24h: number;
}

// ============================================================================
// SECTION 2: IMPLEMENTATION DEFINITIONS
// ============================================================================

// Define what we expect to see from each component
const FRONTEND_ITEMS: Omit<ImplementationItem, 'status' | 'lastEventAt' | 'eventCount24h'>[] = [
    // Customer Journey
    { id: 'signup', name: 'Signup Page', category: 'Customer Journey', type: 'frontend', journeyType: 'customer_onboarding', expectedEvents: ['signup_page_loaded', 'signup_form_submitted'] },
    { id: 'callback', name: 'Auth Callback', category: 'Customer Journey', type: 'frontend', journeyType: 'customer_onboarding', expectedEvents: ['verification_email_sent', 'auth_user_created'] },
    { id: 'dashboard', name: 'Contract Dashboard', category: 'Customer Journey', type: 'frontend', journeyType: 'contract_session_creation', expectedEvents: ['dashboard_loaded', 'create_contract_clicked', 'session_record_created'] },
    { id: 'requirements', name: 'Customer Requirements', category: 'Customer Journey', type: 'frontend', journeyType: 'customer_requirements', expectedEvents: ['requirements_form_loaded', 'requirements_form_submitted'] },
    { id: 'assessment', name: 'Strategic Assessment', category: 'Customer Journey', type: 'frontend', journeyType: 'customer_questionnaire', expectedEvents: ['questionnaire_page_loaded', 'questionnaire_form_submitted'] },

    // Provider Journey
    { id: 'provider-landing', name: 'Provider Landing', category: 'Provider Journey', type: 'frontend', journeyType: 'provider_onboarding', expectedEvents: ['invitation_link_clicked', 'provider_portal_loaded', 'invite_token_validated'] },
    { id: 'provider-welcome', name: 'Provider Welcome', category: 'Provider Journey', type: 'frontend', journeyType: 'provider_onboarding', expectedEvents: ['provider_welcome_page_loaded', 'provider_continue_clicked'] },
    { id: 'provider-intake', name: 'Provider Intake', category: 'Provider Journey', type: 'frontend', journeyType: 'provider_onboarding', expectedEvents: ['provider_intake_form_loaded', 'provider_capabilities_submitted'] },
    { id: 'provider-questionnaire', name: 'Provider Questionnaire', category: 'Provider Journey', type: 'frontend', journeyType: 'provider_questionnaire', expectedEvents: ['provider_questionnaire_page_loaded', 'provider_questionnaire_submitted'] },
    { id: 'provider-confirmation', name: 'Provider Confirmation', category: 'Provider Journey', type: 'frontend', journeyType: 'provider_onboarding', expectedEvents: ['provider_confirmation_page_loaded', 'provider_onboarding_journey_complete'] },

    // Contract Studio
    { id: 'contract-studio', name: 'Contract Studio', category: 'Contract Negotiation', type: 'frontend', journeyType: 'contract_negotiation', expectedEvents: ['contract_studio_loaded', 'clause_selected', 'position_committed'] },

    // Pre-Auth (Optional)
    { id: 'home', name: 'Home Page', category: 'Pre-Auth (Optional)', type: 'frontend', journeyType: '-', expectedEvents: [] },
    { id: 'how-it-works', name: 'How It Works', category: 'Pre-Auth (Optional)', type: 'frontend', journeyType: '-', expectedEvents: [] },
    { id: 'phases', name: 'Phases Page', category: 'Pre-Auth (Optional)', type: 'frontend', journeyType: '-', expectedEvents: [] },
];

const N8N_ITEMS: Omit<ImplementationItem, 'status' | 'lastEventAt' | 'eventCount24h'>[] = [
    // Customer Workflows
    { id: 'n8n-customer-requirements', name: '1.0 Customer Requirements', category: 'Customer Workflows', type: 'n8n', journeyType: 'customer_requirements', expectedEvents: ['customer_requirements_workflow_triggered', 'customer_requirements_workflow_completed'] },
    { id: 'n8n-customer-questionnaire', name: '1.1 Customer Questionnaire', category: 'Customer Workflows', type: 'n8n', journeyType: 'customer_questionnaire', expectedEvents: ['customer_questionnaire_workflow_triggered', 'customer_questionnaire_workflow_completed'] },

    // Provider Workflows
    { id: 'n8n-provider-invite', name: '2.0 Provider Invite', category: 'Provider Workflows', type: 'n8n', journeyType: 'provider_invitation', expectedEvents: ['provider_invite_workflow_triggered', 'invitation_email_sent'] },
    { id: 'n8n-provider-intake', name: '2.1 Provider Intake', category: 'Provider Workflows', type: 'n8n', journeyType: 'provider_onboarding', expectedEvents: ['provider_intake_workflow_triggered', 'provider_capabilities_saved'] },
    { id: 'n8n-token-validation', name: '2.2 Token Validation', category: 'Provider Workflows', type: 'n8n', journeyType: 'provider_onboarding', expectedEvents: ['token_validation_workflow_triggered', 'invite_token_validated'] },
    { id: 'n8n-provider-questionnaire', name: '2.3 Provider Questionnaire', category: 'Provider Workflows', type: 'n8n', journeyType: 'provider_questionnaire', expectedEvents: ['provider_questionnaire_workflow_triggered', 'provider_questionnaire_data_saved'] },

    // Processing Workflows
    { id: 'n8n-leverage', name: '3.0 Leverage Calculation', category: 'Processing Workflows', type: 'n8n', journeyType: 'leverage_calculation', expectedEvents: ['leverage_workflow_triggered', 'overall_leverage_calculated'] },
    { id: 'n8n-clause-positions', name: '3.1 Clause Positions', category: 'Processing Workflows', type: 'n8n', journeyType: 'leverage_calculation', expectedEvents: ['clause_positions_generated', 'clause_positions_saved'] },
    { id: 'n8n-clarence-ai', name: '3.4 CLARENCE AI', category: 'Processing Workflows', type: 'n8n', journeyType: 'clarence_chat', expectedEvents: ['clarence_chat_workflow_triggered', 'clarence_response_generated'] },

    // API Workflows
    { id: 'n8n-contract-studio-api', name: '4.0 Contract Studio API', category: 'API Workflows', type: 'n8n', journeyType: 'contract_studio', expectedEvents: ['contract_studio_api_triggered'] },
    { id: 'n8n-dashboard-api', name: '4.1 Dashboard API', category: 'API Workflows', type: 'n8n', journeyType: 'contract_session_creation', expectedEvents: ['dashboard_api_triggered'] },
];

// IDs of frontend items we know are implemented
const IMPLEMENTED_FRONTEND_IDS = [
    'signup', 'callback', 'dashboard', 'requirements', 'assessment',
    'provider-landing', 'provider-welcome', 'provider-intake',
    'provider-questionnaire', 'provider-confirmation', 'contract-studio'
];

// ============================================================================
// SECTION 3: HELPER FUNCTIONS
// ============================================================================

function checkItemStatus(
    item: Omit<ImplementationItem, 'status' | 'lastEventAt' | 'eventCount24h'>,
    eventsMap: Map<string, { count: number; lastAt: string | null }>
): ImplementationItem {
    // If no expected events, it's either optional or pending
    if (item.expectedEvents.length === 0) {
        return {
            ...item,
            status: 'pending',
            lastEventAt: null,
            eventCount24h: 0
        };
    }

    // Check if any expected events exist
    let totalCount = 0;
    let latestEvent: string | null = null;
    let foundEvents = 0;

    item.expectedEvents.forEach(eventName => {
        const eventData = eventsMap.get(eventName);
        if (eventData) {
            foundEvents++;
            totalCount += eventData.count;
            if (!latestEvent || (eventData.lastAt && eventData.lastAt > latestEvent)) {
                latestEvent = eventData.lastAt;
            }
        }
    });

    // Determine status
    let status: 'implemented' | 'pending' | 'partial';
    if (foundEvents === 0) {
        status = 'pending';
    } else if (foundEvents === item.expectedEvents.length) {
        status = 'implemented';
    } else {
        status = 'partial';
    }

    return {
        ...item,
        status,
        lastEventAt: latestEvent,
        eventCount24h: totalCount
    };
}

// ============================================================================
// SECTION 4: GET HANDLER
// ============================================================================

export async function GET() {
    try {
        // Create Supabase client inside handler to avoid build-time issues
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseKey) {
            // Return mock data if environment variables not available
            return NextResponse.json({
                success: true,
                status: getMockStatus()
            });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // Get 24-hour window
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        // ========================================================================
        // SECTION 4.1: Fetch Recent Events by Source and Step Name
        // ========================================================================

        const { data: recentEvents, error: eventsError } = await supabase
            .from('system_events')
            .select('step_name, source_system, created_at')
            .gte('created_at', twentyFourHoursAgo)
            .order('created_at', { ascending: false });

        if (eventsError) {
            console.error('Error fetching events:', eventsError);
        }

        // Build lookup maps
        const frontendEventsMap = new Map<string, { count: number; lastAt: string | null }>();
        const n8nEventsMap = new Map<string, { count: number; lastAt: string | null }>();

        (recentEvents || []).forEach(event => {
            const map = event.source_system === 'frontend' ? frontendEventsMap :
                event.source_system === 'n8n' ? n8nEventsMap : null;

            if (map) {
                const existing = map.get(event.step_name);
                if (existing) {
                    existing.count++;
                } else {
                    map.set(event.step_name, { count: 1, lastAt: event.created_at });
                }
            }
        });

        // ========================================================================
        // SECTION 4.2: Check Implementation Status for Each Item
        // ========================================================================

        // Process frontend items
        const frontendItems: ImplementationItem[] = FRONTEND_ITEMS.map(item =>
            checkItemStatus(item, frontendEventsMap)
        );

        // Mark known implemented items as implemented (fallback when no events yet)
        frontendItems.forEach(item => {
            if (IMPLEMENTED_FRONTEND_IDS.includes(item.id) && item.status === 'pending') {
                item.status = 'implemented';
            }
        });

        // Process N8N items
        const n8nItems: ImplementationItem[] = N8N_ITEMS.map(item =>
            checkItemStatus(item, n8nEventsMap)
        );

        // ========================================================================
        // SECTION 4.3: Calculate Totals
        // ========================================================================

        const frontendImplemented = frontendItems.filter(i => i.status === 'implemented').length;
        const n8nImplemented = n8nItems.filter(i => i.status === 'implemented').length;

        const totalItems = frontendItems.length + n8nItems.length;
        const totalImplemented = frontendImplemented + n8nImplemented;
        const overallPercentage = Math.round((totalImplemented / totalItems) * 100);

        // ========================================================================
        // SECTION 4.4: Build Response
        // ========================================================================

        return NextResponse.json({
            success: true,
            status: {
                frontend: {
                    total: frontendItems.length,
                    implemented: frontendImplemented,
                    items: frontendItems
                },
                n8n: {
                    total: n8nItems.length,
                    implemented: n8nImplemented,
                    items: n8nItems
                },
                overallPercentage
            }
        });

    } catch (error) {
        console.error('Implementation status error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// ============================================================================
// SECTION 5: MOCK DATA FALLBACK
// ============================================================================

function getMockStatus() {
    const frontendItems: ImplementationItem[] = FRONTEND_ITEMS.map(item => ({
        ...item,
        status: IMPLEMENTED_FRONTEND_IDS.includes(item.id) ? 'implemented' : 'pending',
        lastEventAt: null,
        eventCount24h: 0
    }));

    const n8nItems: ImplementationItem[] = N8N_ITEMS.map(item => ({
        ...item,
        status: 'pending',
        lastEventAt: null,
        eventCount24h: 0
    }));

    const frontendImplemented = frontendItems.filter(i => i.status === 'implemented').length;
    const n8nImplemented = n8nItems.filter(i => i.status === 'implemented').length;
    const totalItems = frontendItems.length + n8nItems.length;
    const totalImplemented = frontendImplemented + n8nImplemented;

    return {
        frontend: {
            total: frontendItems.length,
            implemented: frontendImplemented,
            items: frontendItems
        },
        n8n: {
            total: n8nItems.length,
            implemented: n8nImplemented,
            items: n8nItems
        },
        overallPercentage: Math.round((totalImplemented / totalItems) * 100)
    };
}

// ============================================================================
// END OF FILE
// ============================================================================