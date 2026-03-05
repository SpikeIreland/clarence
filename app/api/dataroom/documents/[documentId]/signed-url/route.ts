import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/dataroom/supabase'

const BUCKET = 'dataroom-documents'

// GET /api/dataroom/documents/[documentId]/signed-url — Generate a signed URL
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params
    const supabase = createServiceRoleClient()

    // Get document
    const { data: doc, error } = await supabase
      .from('dataroom_documents')
      .select('file_path, file_name, file_type')
      .eq('document_id', documentId)
      .eq('is_active', true)
      .single()

    if (error || !doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Generate signed URL (1 hour expiry)
    const { data: signedData, error: signError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(doc.file_path, 3600)

    if (signError || !signedData) {
      console.error('Error creating signed URL:', signError)
      return NextResponse.json(
        { error: 'Failed to generate download URL' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      url: signedData.signedUrl,
      file_name: doc.file_name,
      file_type: doc.file_type,
      expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
    })
  } catch (err) {
    console.error('Error in GET signed-url:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
