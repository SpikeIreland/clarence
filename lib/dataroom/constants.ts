// ============================================================================
// DATA ROOM CONSTANTS
// Location: lib/dataroom/constants.ts
// ============================================================================

export const DATAROOM_TIERS = {
  all: { label: 'All Investors', description: 'Basic investment materials' },
  tier_2: { label: 'Due Diligence', description: 'Technical and legal documentation' },
  tier_3: { label: 'Full Access', description: 'Complete company documentation' },
} as const

export const DATAROOM_DOMAIN = 'dataroom.clarencelegal.ai'
export const DATAROOM_LOCAL_DOMAIN = 'dataroom.localhost:3000'

export const DATAROOM_ADMIN_EMAILS = (
  process.env.NEXT_PUBLIC_DATAROOM_ADMIN_EMAILS || ''
).split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
