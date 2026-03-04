// ============================================================================
// DATA ROOM TYPE DEFINITIONS
// Location: lib/dataroom/types.ts
// ============================================================================

// --- Investor Types ---

export type InvestorTier = 'all' | 'tier_2' | 'tier_3'
export type InvestorStatus = 'invited' | 'active' | 'suspended' | 'revoked'

export interface DataroomInvestor {
  investor_id: string
  user_id: string
  name: string
  email: string
  company_name: string | null
  tier: InvestorTier
  status: InvestorStatus
  invited_by: string | null
  notes: string | null
  last_accessed_at: string | null
  created_at: string
  updated_at: string
}

// --- Category Types ---

export interface DataroomCategory {
  category_id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  display_order: number
  min_tier: InvestorTier
  is_active: boolean
  created_at: string
  updated_at: string
}

// --- Document Types ---

export type DocumentVisibility = 'internal' | 'investor'

export interface DataroomDocument {
  document_id: string
  category_id: string
  title: string
  description: string | null
  file_path: string
  file_name: string
  file_type: string
  file_size_bytes: number | null
  version: number
  visibility: DocumentVisibility
  uploaded_by: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// --- Access Control Types ---

export interface DataroomInvestorAccess {
  access_id: string
  investor_id: string
  category_id: string
  granted_by: string | null
  granted_at: string
  expires_at: string | null
}

// --- Logging Types ---

export type AccessAction = 'viewed' | 'downloaded' | 'login' | 'logout'

export interface DataroomAccessLog {
  log_id: string
  investor_id: string
  document_id: string | null
  action: AccessAction
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

// --- Session Types ---

export interface DataroomSession {
  session_id: string
  investor_id: string
  started_at: string
  last_active_at: string
  documents_viewed: number
  total_time_seconds: number
  is_active: boolean
}

// --- Expense Types (Internal) ---

export interface DataroomExpenseCategory {
  expense_category_id: string
  name: string
  description: string | null
  display_order: number
  is_active: boolean
  created_at: string
}

export type Currency = 'GBP' | 'USD' | 'EUR'
export type RecurringFrequency = 'monthly' | 'quarterly' | 'annually'

export interface DataroomExpense {
  expense_id: string
  expense_category_id: string
  amount: number
  currency: Currency
  description: string
  expense_date: string
  receipt_path: string | null
  entered_by: string
  is_recurring: boolean
  recurring_frequency: RecurringFrequency | null
  created_at: string
  updated_at: string
}

// --- Financial Model Types (Investor-facing) ---

export type FinancialEntryType =
  | 'revenue_projection'
  | 'cost_projection'
  | 'unit_economics'
  | 'runway'
  | 'use_of_funds'
  | 'kpi'
  | 'custom'

export interface DataroomFinancialEntry {
  entry_id: string
  entry_type: FinancialEntryType
  label: string
  period: string | null
  value: number | null
  unit: string | null
  notes: string | null
  display_order: number
  is_visible_to_investors: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

// --- Auth Context ---

export type DataroomUserRole = 'investor' | 'admin'

export interface DataroomAuthContext {
  user_id: string
  email: string
  role: DataroomUserRole
  investor?: DataroomInvestor
}
