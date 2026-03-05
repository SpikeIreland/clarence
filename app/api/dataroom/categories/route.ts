import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/dataroom/supabase'
import type { CategorySection } from '@/lib/dataroom/types'

const SECTION_LABELS: Record<CategorySection, string> = {
  the_investment_case: 'The Investment Case',
  the_company: 'The Company',
  the_product: 'The Product',
  legal_corporate: 'Legal & Corporate',
  full_disclosure: 'Full Disclosure',
  internal: 'Internal',
}

const SECTION_ORDER: CategorySection[] = [
  'the_investment_case',
  'the_company',
  'the_product',
  'legal_corporate',
  'full_disclosure',
  'internal',
]

// GET /api/dataroom/categories — List categories grouped by section
export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceRoleClient()
    const role = request.nextUrl.searchParams.get('role')

    let query = supabase
      .from('dataroom_categories')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    // Filter out internal categories for investor view
    if (role === 'investor') {
      query = query.eq('is_internal_only', false)
    }

    const { data: categories, error } = await query

    if (error) {
      console.error('Error fetching categories:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get document counts per category
    const { data: counts } = await supabase
      .from('dataroom_documents')
      .select('category_id')
      .eq('is_active', true)

    const countMap: Record<string, number> = {}
    if (counts) {
      for (const doc of counts) {
        countMap[doc.category_id] = (countMap[doc.category_id] || 0) + 1
      }
    }

    // Group by section
    const sectionMap = new Map<CategorySection, typeof categories>()
    for (const cat of categories || []) {
      const section = cat.section as CategorySection
      if (!sectionMap.has(section)) sectionMap.set(section, [])
      sectionMap.get(section)!.push({ ...cat, document_count: countMap[cat.category_id] || 0 })
    }

    const sections = SECTION_ORDER
      .filter((s) => sectionMap.has(s))
      .map((s) => ({
        section: s,
        label: SECTION_LABELS[s],
        categories: sectionMap.get(s)!,
      }))

    return NextResponse.json({ sections, categories: categories || [] })
  } catch (err) {
    console.error('Error in GET /api/dataroom/categories:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
