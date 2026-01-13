'use client'

// ============================================================================
// CLARENCE Video Player Component (Database-Backed)
// ============================================================================
// File: /lib/video/VideoPlayer.tsx
// Purpose: Display training videos from the database
// 
// All videos are managed via Admin Panel → Videos tab
// John can add YouTube IDs there and they appear automatically
// ============================================================================

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

// ============================================================================
// SECTION 1: TYPE DEFINITIONS
// ============================================================================

export interface TrainingVideo {
    video_id: string
    video_code: string
    youtube_id: string | null
    title: string
    description: string | null
    duration: string | null
    thumbnail_url: string | null
    category: string
    placement: string[]
    priority: 'high' | 'medium' | 'low'
    status: 'placeholder' | 'scripted' | 'recorded' | 'published'
    script_notes: string | null
    is_active: boolean
    is_featured: boolean
    display_order: number
    created_at: string
    updated_at: string
    published_at: string | null
}

export type VideoCategory =
    | 'onboarding'
    | 'contract_creation'
    | 'contract_prep'
    | 'assessment'
    | 'provider'
    | 'negotiation'
    | 'document_centre'
    | 'training'

interface VideoPlayerProps {
    /** Video code from database (e.g., 'training-intro') */
    videoCode: string
    /** Display variant */
    variant?: 'inline' | 'card' | 'thumbnail' | 'help-button' | 'help-icon'
    /** Size preset */
    size?: 'small' | 'medium' | 'large' | 'full'
    /** Show title */
    showTitle?: boolean
    /** Show description */
    showDescription?: boolean
    /** Custom class names */
    className?: string
    /** Custom label for help button */
    label?: string
    /** Callback when video plays */
    onPlay?: () => void
}

interface VideoGridProps {
    /** Filter by category */
    category?: VideoCategory | string
    /** Only show featured videos */
    featuredOnly?: boolean
    /** Maximum number of videos */
    limit?: number
    /** Custom class names */
    className?: string
}

interface VideoModalProps {
    video: TrainingVideo
    isOpen: boolean
    onClose: () => void
}

// ============================================================================
// SECTION 2: CONSTANTS
// ============================================================================

export const CATEGORY_LABELS: Record<VideoCategory, string> = {
    onboarding: 'Getting Started',
    contract_creation: 'Contract Creation',
    contract_prep: 'Contract Preparation',
    assessment: 'Strategic Assessment',
    provider: 'Provider Management',
    negotiation: 'Negotiation Studio',
    document_centre: 'Document Centre',
    training: 'Training Mode'
}

export const CATEGORY_ICONS: Record<VideoCategory, string> = {
    onboarding: '👋',
    contract_creation: '📝',
    contract_prep: '📋',
    assessment: '📊',
    provider: '🏢',
    negotiation: '⚖️',
    document_centre: '📁',
    training: '🎓'
}

const SIZE_CONFIG = {
    small: { width: 'w-[280px]', height: 'h-[158px]', aspect: 'aspect-video' },
    medium: { width: 'w-[480px]', height: 'h-[270px]', aspect: 'aspect-video' },
    large: { width: 'w-[720px]', height: 'h-[405px]', aspect: 'aspect-video' },
    full: { width: 'w-full', height: 'h-auto', aspect: 'aspect-video' }
}

// ============================================================================
// SECTION 3: VIDEO MODAL COMPONENT
// ============================================================================

export function VideoModal({ video, isOpen, onClose }: VideoModalProps) {
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        if (isOpen) {
            document.addEventListener('keydown', handleEscape)
            document.body.style.overflow = 'hidden'
        }
        return () => {
            document.removeEventListener('keydown', handleEscape)
            document.body.style.overflow = 'unset'
        }
    }, [isOpen, onClose])

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative z-10 w-full max-w-4xl mx-4">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute -top-12 right-0 text-white/80 hover:text-white transition-colors flex items-center gap-2 text-sm"
                >
                    Close
                    <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                        ✕
                    </span>
                </button>

                {/* Video Container */}
                <div className="bg-black rounded-xl overflow-hidden shadow-2xl">
                    {video.youtube_id ? (
                        <div className="aspect-video">
                            <iframe
                                src={`https://www.youtube.com/embed/${video.youtube_id}?autoplay=1&rel=0`}
                                title={video.title}
                                className="w-full h-full"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            />
                        </div>
                    ) : (
                        <VideoPlaceholderContent video={video} size="full" />
                    )}
                </div>

                {/* Video Info */}
                <div className="mt-4 text-white">
                    <h3 className="text-lg font-semibold">{video.title}</h3>
                    {video.description && (
                        <p className="text-white/70 text-sm mt-1">{video.description}</p>
                    )}
                </div>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 4: VIDEO PLACEHOLDER (No YouTube ID Yet)
// ============================================================================

interface VideoPlaceholderProps {
    video: TrainingVideo
    size: keyof typeof SIZE_CONFIG
    onClick?: () => void
}

function VideoPlaceholderContent({ video, size }: { video: TrainingVideo; size: keyof typeof SIZE_CONFIG }) {
    const categoryIcon = CATEGORY_ICONS[video.category as VideoCategory] || '🎬'

    return (
        <div className="relative bg-gradient-to-br from-slate-800 to-slate-900 aspect-video flex items-center justify-center">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10">
                <div className="absolute inset-0" style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                }} />
            </div>

            {/* Content */}
            <div className="relative text-center px-4">
                <div className={`mx-auto mb-3 rounded-full bg-white/10 flex items-center justify-center ${size === 'small' ? 'w-12 h-12 text-2xl' : 'w-16 h-16 text-3xl'}`}>
                    {categoryIcon}
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full text-xs font-medium mb-2">
                    <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
                    Coming Soon
                </div>

                <h4 className={`text-white font-medium ${size === 'small' ? 'text-sm' : 'text-base'}`}>
                    {video.title}
                </h4>

                {video.duration && (
                    <p className="text-white/50 text-xs mt-1">{video.duration}</p>
                )}
            </div>

            {/* CLARENCE Watermark */}
            <div className="absolute bottom-3 right-3 text-white/30 text-xs font-medium">
                CLARENCE
            </div>
        </div>
    )
}

function VideoPlaceholder({ video, size, onClick }: VideoPlaceholderProps) {
    const sizeConfig = SIZE_CONFIG[size]

    return (
        <div
            className={`relative ${size === 'full' ? sizeConfig.width : `${sizeConfig.width} ${sizeConfig.height}`} rounded-lg overflow-hidden ${onClick ? 'cursor-pointer group' : ''}`}
            onClick={onClick}
        >
            <VideoPlaceholderContent video={video} size={size} />

            {/* Play indicator on hover */}
            {onClick && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                    <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
                        <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                        </svg>
                    </div>
                </div>
            )}
        </div>
    )
}

// ============================================================================
// SECTION 5: VIDEO THUMBNAIL
// ============================================================================

interface VideoThumbnailProps {
    video: TrainingVideo
    size: keyof typeof SIZE_CONFIG
    onClick?: () => void
}

function VideoThumbnail({ video, size, onClick }: VideoThumbnailProps) {
    const sizeConfig = SIZE_CONFIG[size]

    if (!video.youtube_id) {
        return <VideoPlaceholder video={video} size={size} onClick={onClick} />
    }

    return (
        <div
            className={`relative ${sizeConfig.aspect} ${size === 'full' ? sizeConfig.width : `${sizeConfig.width} ${sizeConfig.height}`} bg-slate-900 rounded-lg overflow-hidden cursor-pointer group`}
            onClick={onClick}
        >
            <img
                src={`https://img.youtube.com/vi/${video.youtube_id}/maxresdefault.jpg`}
                alt={video.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                    // Fallback to mqdefault if maxresdefault doesn't exist
                    (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${video.youtube_id}/mqdefault.jpg`
                }}
            />
            <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors" />
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-14 h-14 rounded-full bg-red-600 group-hover:bg-red-500 transition-colors flex items-center justify-center shadow-lg">
                    <svg className="w-7 h-7 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                    </svg>
                </div>
            </div>
            {video.duration && (
                <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/80 text-white text-xs rounded">
                    {video.duration}
                </div>
            )}
        </div>
    )
}

// ============================================================================
// SECTION 6: VIDEO CARD COMPONENT
// ============================================================================

interface VideoCardProps {
    video: TrainingVideo
    className?: string
    onClick?: () => void
}

export function VideoCard({ video, className = '', onClick }: VideoCardProps) {
    const [showModal, setShowModal] = useState(false)
    const categoryIcon = CATEGORY_ICONS[video.category as VideoCategory] || '🎬'

    const handleClick = () => {
        if (onClick) {
            onClick()
        } else {
            setShowModal(true)
        }
    }

    return (
        <>
            <div
                className={`bg-white rounded-xl border border-slate-200 overflow-hidden hover:border-slate-300 hover:shadow-md transition-all cursor-pointer ${className}`}
                onClick={handleClick}
            >
                <VideoThumbnail video={video} size="medium" />
                <div className="p-4">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-xl flex-shrink-0">
                            {categoryIcon}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-slate-800 text-sm line-clamp-2">
                                {video.title}
                            </h4>
                            {video.description && (
                                <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                                    {video.description}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
                        {video.duration && (
                            <span className="flex items-center gap-1">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {video.duration}
                            </span>
                        )}
                        {!video.youtube_id && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-600 rounded-full font-medium">
                                Coming Soon
                            </span>
                        )}
                    </div>
                </div>
            </div>
            <VideoModal video={video} isOpen={showModal} onClose={() => setShowModal(false)} />
        </>
    )
}

// ============================================================================
// SECTION 7: VIDEO HELP BUTTON
// ============================================================================

interface VideoHelpButtonProps {
    video: TrainingVideo
    label?: string
    className?: string
}

export function VideoHelpButton({ video, label, className = '' }: VideoHelpButtonProps) {
    const [showModal, setShowModal] = useState(false)

    return (
        <>
            <button
                onClick={() => setShowModal(true)}
                className={`inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 transition-colors ${className}`}
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {label || 'Watch Video'}
            </button>
            <VideoModal video={video} isOpen={showModal} onClose={() => setShowModal(false)} />
        </>
    )
}

// ============================================================================
// SECTION 8: VIDEO HELP ICON
// ============================================================================

interface VideoHelpIconProps {
    video: TrainingVideo
    className?: string
}

export function VideoHelpIcon({ video, className = '' }: VideoHelpIconProps) {
    const [showModal, setShowModal] = useState(false)

    return (
        <>
            <button
                onClick={() => setShowModal(true)}
                className={`w-5 h-5 rounded-full bg-slate-200 hover:bg-blue-100 text-slate-500 hover:text-blue-600 flex items-center justify-center transition-colors ${className}`}
                title={`Watch: ${video.title}`}
            >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </button>
            <VideoModal video={video} isOpen={showModal} onClose={() => setShowModal(false)} />
        </>
    )
}

// ============================================================================
// SECTION 9: MAIN VIDEO PLAYER COMPONENT
// ============================================================================

export default function VideoPlayer({
    videoCode,
    variant = 'inline',
    size = 'medium',
    showTitle = false,
    showDescription = false,
    className = '',
    label,
    onPlay
}: VideoPlayerProps) {
    const [video, setVideo] = useState<TrainingVideo | null>(null)
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [isPlaying, setIsPlaying] = useState(false)

    const supabase = createClient()

    // Fetch video from database
    useEffect(() => {
        async function fetchVideo() {
            try {
                const { data, error } = await supabase
                    .from('training_videos')
                    .select('*')
                    .eq('video_code', videoCode)
                    .eq('is_active', true)
                    .single()

                if (error) throw error
                setVideo(data)
            } catch (err) {
                console.warn(`Video not found: ${videoCode}`)
            } finally {
                setLoading(false)
            }
        }

        fetchVideo()
    }, [videoCode])

    // Loading state
    if (loading) {
        return (
            <div className={`animate-pulse bg-slate-200 rounded-lg ${SIZE_CONFIG[size].aspect} ${className}`} />
        )
    }

    // Video not found
    if (!video) {
        return null
    }

    // Help button variant
    if (variant === 'help-button') {
        return <VideoHelpButton video={video} label={label} className={className} />
    }

    // Help icon variant
    if (variant === 'help-icon') {
        return <VideoHelpIcon video={video} className={className} />
    }

    // Card variant
    if (variant === 'card') {
        return <VideoCard video={video} className={className} />
    }

    // Thumbnail variant (click to open modal)
    if (variant === 'thumbnail') {
        return (
            <>
                <div className={className}>
                    <VideoThumbnail video={video} size={size} onClick={() => setShowModal(true)} />
                    {showTitle && (
                        <h4 className="font-medium text-slate-800 mt-2 text-sm">{video.title}</h4>
                    )}
                    {showDescription && video.description && (
                        <p className="text-xs text-slate-500 mt-1">{video.description}</p>
                    )}
                </div>
                <VideoModal video={video} isOpen={showModal} onClose={() => setShowModal(false)} />
            </>
        )
    }

    // Inline variant (embedded player)
    const sizeConfig = SIZE_CONFIG[size]

    return (
        <div className={className}>
            {video.youtube_id ? (
                <div className={`${sizeConfig.aspect} ${size === 'full' ? sizeConfig.width : `${sizeConfig.width} ${sizeConfig.height}`} rounded-lg overflow-hidden bg-black`}>
                    {isPlaying ? (
                        <iframe
                            src={`https://www.youtube.com/embed/${video.youtube_id}?autoplay=1&rel=0`}
                            title={video.title}
                            className="w-full h-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            onLoad={() => onPlay?.()}
                        />
                    ) : (
                        <VideoThumbnail
                            video={video}
                            size={size}
                            onClick={() => {
                                setIsPlaying(true)
                                onPlay?.()
                            }}
                        />
                    )}
                </div>
            ) : (
                <VideoPlaceholder video={video} size={size} />
            )}
            {showTitle && (
                <h4 className="font-medium text-slate-800 mt-3">{video.title}</h4>
            )}
            {showDescription && video.description && (
                <p className="text-sm text-slate-500 mt-1">{video.description}</p>
            )}
        </div>
    )
}

// ============================================================================
// SECTION 10: VIDEO GRID COMPONENT
// ============================================================================

export function VideoGrid({ category, featuredOnly = false, limit, className = '' }: VideoGridProps) {
    const [videos, setVideos] = useState<TrainingVideo[]>([])
    const [loading, setLoading] = useState(true)

    const supabase = createClient()

    useEffect(() => {
        async function fetchVideos() {
            try {
                let query = supabase
                    .from('training_videos')
                    .select('*')
                    .eq('is_active', true)
                    .order('display_order', { ascending: true })

                if (category) {
                    query = query.eq('category', category)
                }
                if (featuredOnly) {
                    query = query.eq('is_featured', true)
                }
                if (limit) {
                    query = query.limit(limit)
                }

                const { data, error } = await query

                if (error) throw error
                setVideos(data || [])
            } catch (err) {
                console.error('Error loading videos:', err)
            } finally {
                setLoading(false)
            }
        }

        fetchVideos()
    }, [category, featuredOnly, limit])

    if (loading) {
        return (
            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${className}`}>
                {[1, 2, 3].map(i => (
                    <div key={i} className="animate-pulse bg-slate-200 rounded-xl h-64" />
                ))}
            </div>
        )
    }

    if (videos.length === 0) {
        return null
    }

    return (
        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${className}`}>
            {videos.map(video => (
                <VideoCard key={video.video_id} video={video} />
            ))}
        </div>
    )
}

// ============================================================================
// SECTION 11: REACT HOOKS FOR CUSTOM USE
// ============================================================================

/**
 * Hook to fetch a single video by code
 */
export function useVideo(videoCode: string) {
    const [video, setVideo] = useState<TrainingVideo | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    const supabase = createClient()

    useEffect(() => {
        async function fetchVideo() {
            try {
                const { data, error } = await supabase
                    .from('training_videos')
                    .select('*')
                    .eq('video_code', videoCode)
                    .eq('is_active', true)
                    .single()

                if (error) throw error
                setVideo(data)
            } catch (err) {
                setError(err as Error)
                console.warn(`Video not found: ${videoCode}`)
            } finally {
                setLoading(false)
            }
        }

        fetchVideo()
    }, [videoCode])

    return { video, loading, error }
}

/**
 * Hook to fetch multiple videos with filters
 */
export function useVideos(options?: {
    category?: VideoCategory | string
    featuredOnly?: boolean
    limit?: number
}) {
    const [videos, setVideos] = useState<TrainingVideo[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    const supabase = createClient()

    useEffect(() => {
        async function fetchVideos() {
            try {
                let query = supabase
                    .from('training_videos')
                    .select('*')
                    .eq('is_active', true)
                    .order('display_order', { ascending: true })

                if (options?.category) {
                    query = query.eq('category', options.category)
                }
                if (options?.featuredOnly) {
                    query = query.eq('is_featured', true)
                }
                if (options?.limit) {
                    query = query.limit(options.limit)
                }

                const { data, error } = await query

                if (error) throw error
                setVideos(data || [])
            } catch (err) {
                setError(err as Error)
                console.error('Error loading videos:', err)
            } finally {
                setLoading(false)
            }
        }

        fetchVideos()
    }, [options?.category, options?.featuredOnly, options?.limit])

    return { videos, loading, error }
}

// ============================================================================
// SECTION 12: HELPER FUNCTIONS
// ============================================================================

/**
 * Get category label from category code
 */
export function getCategoryLabel(category: string): string {
    return CATEGORY_LABELS[category as VideoCategory] || category
}

/**
 * Get category icon from category code
 */
export function getCategoryIcon(category: string): string {
    return CATEGORY_ICONS[category as VideoCategory] || '🎬'
}