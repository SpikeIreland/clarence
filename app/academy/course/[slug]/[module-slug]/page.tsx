// ============================================================================
// CLARENCE ACADEMY — MODULE / LESSON PAGE
// ============================================================================
// File: app/academy/course/[slug]/[module-slug]/page.tsx
//
// The actual learning experience. Shows the module's lessons in sequence:
// video player, written context, exercise links, and assessment.
// Fetches from academy_modules, academy_lessons, and training_videos.
//
// NOTE: Uses createServiceRoleClient() from @/lib/supabase
// (not createClient from supabase-server)
// ============================================================================

import type { ReactNode } from 'react'
import { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServiceRoleClient } from '@/lib/supabase'
import {
    ArrowLeft,
    ArrowRight,
    BookOpen,
    Award,
    Clock,
    CheckCircle2,
    PlayCircle,
    FileText,
    Target,
    ChevronRight,
    Dumbbell,
    Download,
    ClipboardCheck,
} from 'lucide-react'

// ============================================================================
// TYPES
// ============================================================================

interface Course {
    course_id: string
    title: string
    slug: string
    icon: string
    access_tier: string
    certification_name: string
}

interface Module {
    module_id: string
    course_id: string
    title: string
    slug: string
    description: string
    learning_objectives: string[] | null
    display_order: number
    estimated_minutes: number
    lesson_count: number
}

interface Lesson {
    lesson_id: string
    module_id: string
    title: string
    slug: string
    lesson_type: 'video' | 'context' | 'exercise' | 'assessment' | 'resource'
    display_order: number
    estimated_minutes: number | null
    video_id: string | null
    content_html: string | null
    content_markdown: string | null
    exercise_config: any | null
    exercise_url: string | null
    assessment_config: any | null
    resource_url: string | null
    resource_filename: string | null
    is_required: boolean
}

interface TrainingVideo {
    video_id: string
    youtube_id: string | null
    title: string
    description: string | null
    duration: string | null
}

// ============================================================================
// LESSON TYPE CONFIG
// ============================================================================

const LESSON_ICONS: Record<string, ReactNode> = {
    video: <PlayCircle className="w-5 h-5" />,
    context: <FileText className="w-5 h-5" />,
    exercise: <Dumbbell className="w-5 h-5" />,
    assessment: <ClipboardCheck className="w-5 h-5" />,
    resource: <Download className="w-5 h-5" />,
}

const LESSON_LABELS: Record<string, string> = {
    video: 'Video',
    context: 'Reading',
    exercise: 'Practice Exercise',
    assessment: 'Assessment',
    resource: 'Resource',
}

const LESSON_COLOURS: Record<string, string> = {
    video: 'bg-blue-50 text-blue-700 border-blue-200',
    context: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    exercise: 'bg-amber-50 text-amber-700 border-amber-200',
    assessment: 'bg-violet-50 text-violet-700 border-violet-200',
    resource: 'bg-slate-50 text-slate-700 border-slate-200',
}

// ============================================================================
// METADATA
// ============================================================================

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string; 'module-slug': string }>
}): Promise<Metadata> {
    const { slug, 'module-slug': moduleSlug } = await params
    const supabase = createServiceRoleClient()

    const { data: course } = await supabase
        .from('academy_courses')
        .select('course_id, title')
        .eq('slug', slug)
        .eq('status', 'published')
        .single()

    if (!course) return { title: 'Module Not Found | Clarence Academy' }

    const { data: mod } = await supabase
        .from('academy_modules')
        .select('title, description')
        .eq('course_id', course.course_id)
        .eq('slug', moduleSlug)
        .eq('status', 'published')
        .single()

    if (!mod) return { title: 'Module Not Found | Clarence Academy' }

    return {
        title: `${mod.title} | ${course.title} | Clarence Academy`,
        description: mod.description || undefined,
    }
}

// ============================================================================
// DATA FETCHING
// ============================================================================

async function getCourseBySlug(slug: string): Promise<Course | null> {
    const supabase = createServiceRoleClient()
    const { data } = await supabase
        .from('academy_courses')
        .select('course_id, title, slug, icon, access_tier, certification_name')
        .eq('slug', slug)
        .eq('status', 'published')
        .eq('is_active', true)
        .single()
    return data || null
}

async function getModule(courseId: string, moduleSlug: string): Promise<Module | null> {
    const supabase = createServiceRoleClient()
    const { data } = await supabase
        .from('academy_modules')
        .select('*')
        .eq('course_id', courseId)
        .eq('slug', moduleSlug)
        .eq('status', 'published')
        .eq('is_active', true)
        .single()
    return data || null
}

async function getLessons(moduleId: string): Promise<Lesson[]> {
    const supabase = createServiceRoleClient()
    const { data, error } = await supabase
        .from('academy_lessons')
        .select('*')
        .eq('module_id', moduleId)
        .eq('status', 'published')
        .eq('is_active', true)
        .order('display_order', { ascending: true })

    if (error) {
        console.error('Error fetching lessons:', error)
        return []
    }
    return data || []
}

async function getVideoDetails(videoId: string): Promise<TrainingVideo | null> {
    const supabase = createServiceRoleClient()
    const { data } = await supabase
        .from('training_videos')
        .select('video_id, youtube_id, title, description, duration')
        .eq('video_id', videoId)
        .single()
    return data || null
}

async function getAdjacentModules(
    courseId: string,
    displayOrder: number
): Promise<{ prev: { slug: string; title: string } | null; next: { slug: string; title: string } | null }> {
    const supabase = createServiceRoleClient()

    const { data: prevData } = await supabase
        .from('academy_modules')
        .select('slug, title')
        .eq('course_id', courseId)
        .eq('status', 'published')
        .eq('is_active', true)
        .lt('display_order', displayOrder)
        .order('display_order', { ascending: false })
        .limit(1)
        .single()

    const { data: nextData } = await supabase
        .from('academy_modules')
        .select('slug, title')
        .eq('course_id', courseId)
        .eq('status', 'published')
        .eq('is_active', true)
        .gt('display_order', displayOrder)
        .order('display_order', { ascending: true })
        .limit(1)
        .single()

    return { prev: prevData || null, next: nextData || null }
}

async function getAllModulesForSidebar(courseId: string): Promise<{ module_id: string; title: string; slug: string; display_order: number }[]> {
    const supabase = createServiceRoleClient()
    const { data } = await supabase
        .from('academy_modules')
        .select('module_id, title, slug, display_order')
        .eq('course_id', courseId)
        .eq('status', 'published')
        .eq('is_active', true)
        .order('display_order', { ascending: true })
    return data || []
}

// ============================================================================
// VIDEO COMPONENT
// ============================================================================

async function VideoLesson({ lesson }: { lesson: Lesson }) {
    if (!lesson.video_id) {
        return (
            <div className="aspect-video bg-slate-100 rounded-xl flex items-center justify-center">
                <div className="text-center">
                    <PlayCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">Video coming soon</p>
                </div>
            </div>
        )
    }

    const video = await getVideoDetails(lesson.video_id)

    if (!video?.youtube_id) {
        return (
            <div className="aspect-video bg-slate-100 rounded-xl flex items-center justify-center">
                <div className="text-center">
                    <PlayCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">Video being prepared</p>
                    {video?.title && (
                        <p className="text-sm text-slate-400 mt-1">{video.title}</p>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div>
            <div className="aspect-video rounded-xl overflow-hidden bg-black shadow-lg">
                <iframe
                    src={`https://www.youtube.com/embed/${video.youtube_id}?rel=0&modestbranding=1`}
                    title={video.title || lesson.title}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                />
            </div>
            {video.duration && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{video.duration}</span>
                </div>
            )}
        </div>
    )
}

// ============================================================================
// CONTEXT COMPONENT
// ============================================================================

function ContextLesson({ lesson }: { lesson: Lesson }) {
    if (!lesson.content_html && !lesson.content_markdown) {
        return (
            <div className="p-8 bg-slate-50 rounded-xl border border-slate-200 text-center">
                <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">Written content coming soon</p>
            </div>
        )
    }

    return (
        <div className="prose prose-slate max-w-none">
            {lesson.content_html ? (
                <div dangerouslySetInnerHTML={{ __html: lesson.content_html }} />
            ) : (
                <div className="whitespace-pre-wrap text-slate-700 leading-relaxed">
                    {lesson.content_markdown}
                </div>
            )}
        </div>
    )
}

// ============================================================================
// EXERCISE COMPONENT
// ============================================================================

function ExerciseLesson({ lesson }: { lesson: Lesson }) {
    return (
        <div className="p-6 bg-amber-50 rounded-xl border border-amber-200">
            <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Dumbbell className="w-5 h-5 text-amber-600" />
                </div>
                <div className="flex-1">
                    <h4 className="font-semibold text-slate-800 mb-1">
                        {lesson.title}
                    </h4>
                    <p className="text-sm text-slate-600 mb-4">
                        Put what you have learned into practice in the Training
                        Studio. Negotiate against an AI opponent calibrated to
                        this module's content.
                    </p>
                    {lesson.exercise_url ? (
                        <a
                            href={lesson.exercise_url}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold transition-colors"
                        >
                            <Target className="w-4 h-4" />
                            Start Exercise
                        </a>
                    ) : (
                        <p className="text-sm text-amber-700 italic">
                            Training Studio exercise coming soon
                        </p>
                    )}
                </div>
            </div>
        </div>
    )
}

// ============================================================================
// ASSESSMENT COMPONENT
// ============================================================================

function AssessmentLesson({ lesson }: { lesson: Lesson }) {
    return (
        <div className="p-6 bg-violet-50 rounded-xl border border-violet-200">
            <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <ClipboardCheck className="w-5 h-5 text-violet-600" />
                </div>
                <div className="flex-1">
                    <h4 className="font-semibold text-slate-800 mb-1">
                        {lesson.title}
                    </h4>
                    <p className="text-sm text-slate-600 mb-4">
                        Complete this assessment to demonstrate your
                        understanding and progress toward certification.
                    </p>
                    <p className="text-sm text-violet-700 italic">
                        Assessment coming soon
                    </p>
                </div>
            </div>
        </div>
    )
}

// ============================================================================
// RESOURCE COMPONENT
// ============================================================================

function ResourceLesson({ lesson }: { lesson: Lesson }) {
    return (
        <div className="p-5 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Download className="w-5 h-5 text-slate-600" />
                </div>
                <div className="flex-1">
                    <h4 className="font-semibold text-slate-800">
                        {lesson.title}
                    </h4>
                    {lesson.resource_filename && (
                        <p className="text-sm text-slate-500">{lesson.resource_filename}</p>
                    )}
                </div>
                {lesson.resource_url ? (
                    <a
                        href={lesson.resource_url}
                        className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-sm font-medium border border-slate-300 transition-colors"
                    >
                        Download
                    </a>
                ) : (
                    <span className="text-sm text-slate-400 italic">Coming soon</span>
                )}
            </div>
        </div>
    )
}

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default async function ModulePage({
    params,
}: {
    params: Promise<{ slug: string; 'module-slug': string }>
}) {
    const { slug, 'module-slug': moduleSlug } = await params
    const course = await getCourseBySlug(slug)
    if (!course) notFound()

    const module_ = await getModule(course.course_id, moduleSlug)
    if (!module_) notFound()

    const [lessons, adjacent, allModules] = await Promise.all([
        getLessons(module_.module_id),
        getAdjacentModules(course.course_id, module_.display_order),
        getAllModulesForSidebar(course.course_id),
    ])

    const totalMinutes = lessons.reduce((sum, l) => sum + (l.estimated_minutes || 0), 0)

    return (
        <main className="min-h-screen bg-slate-50">
            {/* ================================================================ */}
            {/* NAVIGATION                                                       */}
            {/* ================================================================ */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
                <div className="container mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Link href="/" className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-lg flex items-center justify-center">
                                    <span className="text-white text-sm font-bold">C</span>
                                </div>
                                <span className="text-xl font-bold text-slate-800">CLARENCE</span>
                            </Link>
                            <span className="text-slate-300 font-light">|</span>
                            <Link href="/" className="text-lg font-semibold text-slate-600 hover:text-slate-800 transition-colors">
                                Academy
                            </Link>
                        </div>

                        <nav className="hidden md:flex items-center gap-6">
                            <Link
                                href={`/course/${course.slug}`}
                                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                            >
                                Back to Course
                            </Link>
                            <Link
                                href="https://clarencelegal.ai/auth/register"
                                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-colors"
                            >
                                Start Learning
                            </Link>
                        </nav>
                    </div>
                </div>
            </header>

            {/* ================================================================ */}
            {/* BREADCRUMB                                                       */}
            {/* ================================================================ */}
            <div className="bg-white border-b border-slate-100">
                <div className="container mx-auto px-6 py-3">
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Link href="/" className="hover:text-slate-700 transition-colors">Academy</Link>
                        <ChevronRight className="w-3.5 h-3.5" />
                        <Link href={`/course/${course.slug}`} className="hover:text-slate-700 transition-colors">
                            {course.title}
                        </Link>
                        <ChevronRight className="w-3.5 h-3.5" />
                        <span className="text-slate-800 font-medium">{module_.title}</span>
                    </div>
                </div>
            </div>

            {/* ================================================================ */}
            {/* MAIN CONTENT AREA                                                */}
            {/* ================================================================ */}
            <div className="container mx-auto px-6 py-8">
                <div className="flex gap-8 max-w-7xl">
                    {/* ──────────────────────────────────────────────────────── */}
                    {/* SIDEBAR — Module navigation                             */}
                    {/* ──────────────────────────────────────────────────────── */}
                    <aside className="hidden lg:block w-72 flex-shrink-0">
                        <div className="sticky top-24">
                            <div className="bg-white rounded-xl border border-slate-200 p-4">
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="text-lg">{course.icon}</span>
                                    <h3 className="font-semibold text-slate-800 text-sm">
                                        {course.title}
                                    </h3>
                                </div>

                                <nav className="space-y-1">
                                    {allModules.map((m, index) => {
                                        const isCurrent = m.module_id === module_.module_id
                                        return (
                                            <Link
                                                key={m.module_id}
                                                href={`https://academy.clarencelegal.ai/course/${course.slug}/${m.slug}`}
                                                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isCurrent
                                                        ? 'bg-emerald-50 text-emerald-700 font-medium'
                                                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                                                    }`}
                                            >
                                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 ${isCurrent
                                                        ? 'bg-emerald-600 text-white'
                                                        : 'bg-slate-100 text-slate-500'
                                                    }`}>
                                                    {index + 1}
                                                </span>
                                                <span className="line-clamp-2">{m.title}</span>
                                            </Link>
                                        )
                                    })}
                                </nav>
                            </div>
                        </div>
                    </aside>

                    {/* ──────────────────────────────────────────────────────── */}
                    {/* MAIN CONTENT                                            */}
                    {/* ──────────────────────────────────────────────────────── */}
                    <div className="flex-1 min-w-0 max-w-3xl">
                        {/* Module header */}
                        <div className="mb-8">
                            <div className="flex items-center gap-3 mb-3">
                                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    Module {module_.display_order}
                                </span>
                                {module_.estimated_minutes && (
                                    <>
                                        <span className="text-slate-300">·</span>
                                        <div className="flex items-center gap-1 text-xs text-slate-500">
                                            <Clock className="w-3.5 h-3.5" />
                                            <span>{module_.estimated_minutes} min</span>
                                        </div>
                                    </>
                                )}
                                {lessons.length > 0 && (
                                    <>
                                        <span className="text-slate-300">·</span>
                                        <div className="flex items-center gap-1 text-xs text-slate-500">
                                            <BookOpen className="w-3.5 h-3.5" />
                                            <span>{lessons.length} lessons</span>
                                        </div>
                                    </>
                                )}
                            </div>

                            <h1 className="text-2xl md:text-3xl font-bold text-slate-800 mb-3">
                                {module_.title}
                            </h1>

                            {module_.description && (
                                <p className="text-slate-600 leading-relaxed">
                                    {module_.description}
                                </p>
                            )}

                            {/* Learning objectives */}
                            {module_.learning_objectives && module_.learning_objectives.length > 0 && (
                                <div className="mt-5 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                                    <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800 mb-3">
                                        <Target className="w-4 h-4" />
                                        <span>Learning Objectives</span>
                                    </div>
                                    <ul className="space-y-2">
                                        {module_.learning_objectives.map((obj, i) => (
                                            <li key={i} className="flex items-start gap-2 text-sm text-emerald-900">
                                                <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                                                <span>{obj}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        {/* ──────────────────────────────────────────────────── */}
                        {/* LESSONS                                             */}
                        {/* ──────────────────────────────────────────────────── */}
                        <div className="space-y-8">
                            {lessons.map((lesson, index) => (
                                <section key={lesson.lesson_id} id={lesson.slug}>
                                    {/* Lesson header */}
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${LESSON_COLOURS[lesson.lesson_type]}`}>
                                            {LESSON_ICONS[lesson.lesson_type]}
                                            <span>{LESSON_LABELS[lesson.lesson_type]}</span>
                                        </div>
                                        <h2 className="font-semibold text-slate-800">
                                            {lesson.title}
                                        </h2>
                                        {lesson.estimated_minutes && (
                                            <span className="text-xs text-slate-400">
                                                {lesson.estimated_minutes} min
                                            </span>
                                        )}
                                        {!lesson.is_required && (
                                            <span className="text-xs text-slate-400 italic">
                                                Optional
                                            </span>
                                        )}
                                    </div>

                                    {/* Lesson content by type */}
                                    <div className="bg-white rounded-xl border border-slate-200 p-6">
                                        {lesson.lesson_type === 'video' && (
                                            <VideoLesson lesson={lesson} />
                                        )}
                                        {lesson.lesson_type === 'context' && (
                                            <ContextLesson lesson={lesson} />
                                        )}
                                        {lesson.lesson_type === 'exercise' && (
                                            <ExerciseLesson lesson={lesson} />
                                        )}
                                        {lesson.lesson_type === 'assessment' && (
                                            <AssessmentLesson lesson={lesson} />
                                        )}
                                        {lesson.lesson_type === 'resource' && (
                                            <ResourceLesson lesson={lesson} />
                                        )}
                                    </div>
                                </section>
                            ))}

                            {lessons.length === 0 && (
                                <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                                    <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-4" />
                                    <p className="text-slate-600 font-medium">
                                        Lessons are being prepared
                                    </p>
                                    <p className="text-sm text-slate-500 mt-1">
                                        Content for this module is currently in
                                        development. Check back soon.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* ──────────────────────────────────────────────────── */}
                        {/* MODULE NAVIGATION (PREV / NEXT)                     */}
                        {/* ──────────────────────────────────────────────────── */}
                        <div className="mt-12 pt-8 border-t border-slate-200 flex items-center justify-between">
                            {adjacent.prev ? (
                                <Link
                                    href={`https://academy.clarencelegal.ai/course/${course.slug}/${adjacent.prev.slug}`}
                                    className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-emerald-700 transition-colors"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    <div>
                                        <div className="text-xs text-slate-400">Previous module</div>
                                        <div>{adjacent.prev.title}</div>
                                    </div>
                                </Link>
                            ) : (
                                <Link
                                    href={`https://academy.clarencelegal.ai/course/${course.slug}`}
                                    className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-emerald-700 transition-colors"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    <div>
                                        <div className="text-xs text-slate-400">Back to</div>
                                        <div>Course Overview</div>
                                    </div>
                                </Link>
                            )}

                            {adjacent.next ? (
                                <Link
                                    href={`https://academy.clarencelegal.ai/course/${course.slug}/${adjacent.next.slug}`}
                                    className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-emerald-700 transition-colors text-right"
                                >
                                    <div>
                                        <div className="text-xs text-slate-400">Next module</div>
                                        <div>{adjacent.next.title}</div>
                                    </div>
                                    <ArrowRight className="w-4 h-4" />
                                </Link>
                            ) : (
                                <Link
                                    href={`/course/${course.slug}`}
                                    className="flex items-center gap-2 text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors text-right"
                                >
                                    <div>
                                        <div className="text-xs text-slate-400">Completed</div>
                                        <div className="flex items-center gap-1">
                                            <Award className="w-4 h-4" />
                                            Back to Course
                                        </div>
                                    </div>
                                    <ArrowRight className="w-4 h-4" />
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ================================================================ */}
            {/* FOOTER                                                           */}
            {/* ================================================================ */}
            <footer className="bg-slate-800 py-8 mt-12">
                <div className="container mx-auto px-6">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-md flex items-center justify-center">
                                <span className="text-white text-xs font-bold">C</span>
                            </div>
                            <span className="text-sm font-bold text-white">CLARENCE</span>
                            <span className="text-slate-500 font-light">|</span>
                            <span className="text-sm text-slate-400">Academy</span>
                        </div>
                        <p className="text-xs text-slate-500">
                            &copy; {new Date().getFullYear()} Clarence Legal Limited. All rights reserved.
                        </p>
                    </div>
                </div>
            </footer>
        </main>
    )
}