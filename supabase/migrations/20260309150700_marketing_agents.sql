-- Create social_posts table to hold generated marketing content
CREATE TABLE IF NOT EXISTS public.social_posts (
    post_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    video_id UUID REFERENCES public.training_videos(video_id) ON DELETE SET NULL,
    
    youtube_title_optimized TEXT,
    youtube_description_optimized TEXT,
    youtube_status VARCHAR(50) DEFAULT 'draft' CHECK (youtube_status IN ('draft', 'scheduled', 'published')),
    youtube_published_at TIMESTAMPTZ,
    youtube_url TEXT,
    
    linkedin_post_content TEXT,
    linkedin_status VARCHAR(50) DEFAULT 'draft' CHECK (linkedin_status IN ('draft', 'scheduled', 'published')),
    linkedin_published_at TIMESTAMPTZ,
    linkedin_url TEXT,

    campaign_source VARCHAR(100),
    is_approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;

-- Allow read/write access to authenticated admins
CREATE POLICY "Admins can manage social posts" 
    ON public.social_posts 
    FOR ALL 
    TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.auth_id = auth.uid() 
            AND users.role = 'admin'
        )
    );

