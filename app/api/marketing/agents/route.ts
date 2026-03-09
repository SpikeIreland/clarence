import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// Update this with the real n8n webhook URL when deployed
const N8N_WEBHOOK_URL = 'https://spikeislandstudios.app.n8n.cloud/webhook/generate-marketing-copy'

export async function POST(request: Request) {
    try {
        const supabase = createRouteHandlerClient({ cookies })
        const { data: { session } } = await supabase.auth.getSession()

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Verify admin role
        const { data: profile } = await supabase
            .from('users')
            .select('role')
            .eq('auth_id', session.user.id)
            .single()

        if (profile?.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 })
        }

        const body = await request.json()
        const { videoId, generateYoutube, generateLinkedin } = body

        if (!videoId) {
            return NextResponse.json({ error: 'Video ID is required' }, { status: 400 })
        }

        // Get video details to send to n8n
        const { data: video, error: videoError } = await supabase
            .from('training_videos')
            .select('*')
            .eq('video_id', videoId)
            .single()

        if (videoError || !video) {
            return NextResponse.json({ error: 'Video not found' }, { status: 404 })
        }

        // Trigger n8n webhook
        const response = await fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
                videoId,
                videoTitle: video.title,
                videoNotes: video.script_notes,
                generateYoutube,
                generateLinkedin,
                adminEmail: session.user.email
            })
        })

        if (!response.ok) {
            throw new Error('Failed to trigger n8n workflow')
        }

        return NextResponse.json({ success: true, message: 'Marketing copy generation started' })
    } catch (error: any) {
        console.error('Error in agent route:', error)
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        )
    }
}
