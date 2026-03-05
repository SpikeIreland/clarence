import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/dataroom/supabase'
import { createClient } from '@supabase/supabase-js'

const BUCKET = 'dataroom-documents'
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

// Helper: get authenticated user from request
async function getAuthUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const token = authHeader.replace('Bearer ', '')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user } } = await supabase.auth.getUser(token)
  return user
}

// GET /api/dataroom/documents — List documents
export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceRoleClient()
    const categoryId = request.nextUrl.searchParams.get('category_id')
    const categorySlug = request.nextUrl.searchParams.get('category_slug')
    const visibility = request.nextUrl.searchParams.get('visibility')

    let query = supabase
      .from('dataroom_documents')
      .select(`
        *,
        category:dataroom_categories(name, slug, section, min_tier)
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (categoryId) {
      query = query.eq('category_id', categoryId)
    }

    if (visibility) {
      query = query.eq('visibility', visibility)
    }

    const { data: documents, error } = await query

    if (error) {
      console.error('Error fetching documents:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // If filtering by slug, do it client-side after join
    let filtered = documents || []
    if (categorySlug) {
      filtered = filtered.filter(
        (d) => (d.category as { slug: string } | null)?.slug === categorySlug
      )
    }

    return NextResponse.json({ documents: filtered })
  } catch (err) {
    console.error('Error in GET /api/dataroom/documents:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/dataroom/documents — Upload a document (admin only)
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const title = formData.get('title') as string | null
    const description = formData.get('description') as string | null
    const categoryId = formData.get('category_id') as string | null
    const visibility = (formData.get('visibility') as string) || 'investor'

    if (!file || !title || !categoryId) {
      return NextResponse.json(
        { error: 'File, title, and category are required' },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds 50MB limit' },
        { status: 400 }
      )
    }

    const supabase = createServiceRoleClient()

    // Get category slug for file path
    const { data: category } = await supabase
      .from('dataroom_categories')
      .select('slug')
      .eq('category_id', categoryId)
      .single()

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    // Build storage path
    const timestamp = Date.now()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `${category.slug}/${timestamp}-${safeName}`

    // Upload to Supabase Storage
    const fileBuffer = await file.arrayBuffer()
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return NextResponse.json(
        { error: `Upload failed: ${uploadError.message}` },
        { status: 500 }
      )
    }

    // Insert document record
    const { data: document, error: insertError } = await supabase
      .from('dataroom_documents')
      .insert({
        category_id: categoryId,
        title,
        description: description || null,
        file_path: storagePath,
        file_name: file.name,
        file_type: file.type,
        file_size_bytes: file.size,
        visibility,
        uploaded_by: user.id,
      })
      .select(`
        *,
        category:dataroom_categories(name, slug)
      `)
      .single()

    if (insertError) {
      // Clean up the uploaded file
      await supabase.storage.from(BUCKET).remove([storagePath])
      console.error('Error inserting document:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, document })
  } catch (err) {
    console.error('Error in POST /api/dataroom/documents:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/dataroom/documents — Delete a document
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { document_id } = body

    if (!document_id) {
      return NextResponse.json(
        { error: 'document_id is required' },
        { status: 400 }
      )
    }

    const supabase = createServiceRoleClient()

    // Get document to find file path
    const { data: doc } = await supabase
      .from('dataroom_documents')
      .select('file_path')
      .eq('document_id', document_id)
      .single()

    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Delete from storage
    await supabase.storage.from(BUCKET).remove([doc.file_path])

    // Delete record
    const { error } = await supabase
      .from('dataroom_documents')
      .delete()
      .eq('document_id', document_id)

    if (error) {
      console.error('Error deleting document:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error in DELETE /api/dataroom/documents:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
