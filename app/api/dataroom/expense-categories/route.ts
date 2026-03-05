import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/dataroom/supabase'

// GET /api/dataroom/expense-categories — List all active expense categories
export async function GET() {
  try {
    const supabase = createServiceRoleClient()

    const { data, error } = await supabase
      .from('dataroom_expense_categories')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (error) {
      console.error('Error fetching expense categories:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ categories: data || [] })
  } catch (err) {
    console.error('Error in GET /api/dataroom/expense-categories:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
