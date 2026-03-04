// ============================================================================
// DATA ROOM SUPABASE CLIENT
// Location: lib/dataroom/supabase.ts
//
// Re-exports the shared Supabase clients. Separate file allows adding
// data room-specific configuration in the future without changing imports.
// ============================================================================

export { createClient, createServiceRoleClient } from '@/lib/supabase'
