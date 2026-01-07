// ============================================================================
// SUPABASE CLIENT CONFIGURATION
// Location: lib/supabase.ts
// ============================================================================

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// ============================================================================
// SECTION 1: CLIENT-SIDE CLIENT (for React components)
// ============================================================================

export function createClient() {
    return createClientComponentClient()
}

// ============================================================================
// SECTION 2: SERVER-SIDE SERVICE ROLE CLIENT (for API routes/callbacks)
// Use this for server-side operations that need full database access
// NEVER expose this client or the service role key to the browser
// ============================================================================

export function createServiceRoleClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables')
    }

    return createSupabaseClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    })
}