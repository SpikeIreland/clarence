// ============================================================================
// CLARENCE ACADEMY — COURSE DETAIL PAGE
// ============================================================================
// File: app/academy/course/[slug]/page.tsx
//
// Server component — fetches course + modules from Supabase.
// Shows course overview, module listing with progress (if logged in),
// certification info, and enrol/continue CTA.
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
    Lock,
    Globe,
    UserPlus,
    GraduationCap,
    PlayCircle,
    ChevronRight,
    Target,
} from 'lucide-react'

// ============================================================================
// TYPES
// ============================================================================

interface Course {
    course_id: string
    title: string
    slug: string
    description: string
    short_description: string
    icon: string
    cover_image_url: string | null
    access_tier: 'open' | 'registered' | 'subscriber'
    display_order: number
    estimated_hours: number
    module_count: number
    certification_name: string
    certification_level: string
    status: string
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
    is_free_preview: boolean
    status: string
}

// ============================================================================
// ACCESS TIER CONFIG
// ============================================================================

const ACCESS_TIERS: Record<
    string,
    { label: string; description: string; icon: ReactNode; color: string; bg: string }
> = {
    open: {
        label: 'Free Access',
        description: 'This course is completely free. No account required to browse, register to track progress.',
        icon: <Globe className="w-5 h-5" />,
        color: 'text-emerald-700',
        bg: 'bg-emerald-50 border-emerald-200',
    },
    registered: {
        label: 'Free Registration',
        description: 'Register for a free account to access this course. No subscription or payment required.',
        icon: <UserPlus className="w-5 h-5" />,
        color: 'text-blue-700',
        bg: 'bg-blue-50 border-blue-200',
    },
    subscriber: {
        label: 'Subscriber Access',
        description: 'This course requires an active Clarence platform subscription or Academy Seat.',
        icon: <Lock className="w-5 h-5" />,
        color: 'text-violet-700',
        bg: 'bg-violet-50 border-violet-200',
    },
}

// ============================================================================
// CERTIFICATION LEVEL COLOURS
// ============================================================================

const CERT_COLOURS: Record<string, { border: string; bg: string; text: string }> = {
    foundations: { border: 'border-emerald-300', bg: 'bg-emerald-50', text: 'text-emerald-700' },
    practitioner: { border: 'border-blue-300', bg: 'bg-blue-50', text: 'text-blue-700' },
    specialist: { border: 'border-amber-300', bg: 'bg-amber-50', text: 'text-amber-700' },
    compliance: { border: 'border-violet-300', bg: 'bg-violet-50', text: 'text-violet-700' },
    master: { border: 'border-slate-400', bg: 'bg-slate-100', text: 'text-slate-700' },
}

// ============================================================================
// METADATA
// ============================================================================

export async function generateMetadata({
    params,
}: {
    params: { slug: string }
}): Promise<Metadata> {
    const supabase = createServiceRoleClient()
    const { data: course } = await supabase
        .from('academy_courses')
        .select('title, short_description')
        .eq('slug', params.slug)
        .eq('status', 'published')
        .single()

    if (!course) {
        return { title: 'Course Not Found | Clarence Academy' }
    }

    return {
        title: `${course.title} | Clarence Academy`,
        description: course.short_description,
    }
}

// ============================================================================
// DATA FETCHING
// ============================================================================

async function getCourse(slug: string): Promise<Course | null> {
    const supabase = createServiceRoleClient()

    const { data, error } = await supabase
        .from('academy_courses')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'published')
        .eq('is_active', true)
        .single()

    if (error || !data) return null
    return data
}

async function getModules(courseId: string): Promise<Module[]> {
    const supabase = createServiceRoleClient()

    const { data, error } = await supabase
        .from('academy_modules')
        .select('*')
        .eq('course_id', courseId)
        .eq('status', 'published')
        .eq('is_active', true)
        .order('display_order', { ascending: true })

    if (error) {
        console.error('Error fetching modules:', error)
        return []
    }

    return data || []
}

async function getAdjacentCourses(
    displayOrder: number
): Promise<{ prev: { slug: string; title: string } | null; next: { slug: string; title: string } | null }> {
    const supabase = createServiceRoleClient()

    const { data: prevData } = await supabase
        .from('academy_courses')
        .select('slug, title')
        .eq('status', 'published')
        .eq('is_active', true)
        .lt('display_order', displayOrder)
        .order('display_order', { ascending: false })
        .limit(1)
        .single()

    const { data: nextData } = await supabase
        .from('academy_courses')
        .select('slug, title')
        .eq('status', 'published')
        .eq('is_active', true)
        .gt('display_order', displayOrder)
        .order('display_order', { ascending: true })
        .limit(1)
        .single()

    return {
        prev: prevData || null,
        next: nextData || null,
    }
}

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default async function CourseDetailPage({
    params,
}: {
    params: { slug: string }
}) {
    const course = await getCourse(params.slug)

    if (!course) {
        notFound()
    }

    const [modules, adjacent] = await Promise.all([
        getModules(course.course_id),
        getAdjacentCourses(course.display_order),
    ])

    const tier = ACCESS_TIERS[course.access_tier]
    const certColour = CERT_COLOURS[course.certification_level] || CERT_COLOURS.foundations

    // Calculate total module minutes
    const totalMinutes = modules.reduce((sum, m) => sum + (m.estimated_minutes || 0), 0)
    const totalLessons = modules.reduce((sum, m) => sum + (m.lesson_count || 0), 0)

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
                                href="/"
                                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                            >
                                All Courses
                            </Link>
                            <Link
                                href="/auth/register"
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
                        <Link href="/" className="hover:text-slate-700 transition-colors">
                            Academy
                        </Link>
                        <ChevronRight className="w-3.5 h-3.5" />
                        <span className="text-slate-800 font-medium">{course.title}</span>
                    </div>
                </div>
            </div>

            {/* ================================================================ */}
            {/* COURSE HERO                                                      */}
            {/* ================================================================ */}
            <section className="bg-white border-b border-slate-200">
                <div className="container mx-auto px-6 py-12 md:py-16">
                    <div className="max-w-4xl">
                        {/* Course number & access tier */}
                        <div className="flex items-center gap-3 mb-6">
                            <span className="text-sm font-medium text-slate-400">
                                Course {course.display_order} of 7
                            </span>
                            <span className="text-slate-300">·</span>
                            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${tier.bg} ${tier.color}`}>
                                {tier.icon}
                                <span>{tier.label}</span>
                            </div>
                        </div>

                        {/* Icon & Title */}
                        <div className="flex items-start gap-4 mb-6">
                            <span className="text-5xl">{course.icon}</span>
                            <div>
                                <h1 className="text-3xl md:text-4xl font-bold text-slate-800 mb-3">
                                    {course.title}
                                </h1>
                                <p className="text-lg text-slate-600 leading-relaxed">
                                    {course.description}
                                </p>
                            </div>
                        </div>

                        {/* Meta stats */}
                        <div className="flex flex-wrap items-center gap-6 mb-8">
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                <Clock className="w-4 h-4 text-slate-400" />
                                <span>{course.estimated_hours} hours</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                <BookOpen className="w-4 h-4 text-slate-400" />
                                <span>{modules.length} modules</span>
                            </div>
                            {totalLessons > 0 && (
                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                    <PlayCircle className="w-4 h-4 text-slate-400" />
                                    <span>{totalLessons} lessons</span>
                                </div>
                            )}
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                <Award className="w-4 h-4 text-slate-400" />
                                <span>{course.certification_name}</span>
                            </div>
                        </div>

                        {/* CTA */}
                        <div className="flex flex-col sm:flex-row items-start gap-4">
                            <Link
                                href="/auth/register"
                                className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-base font-semibold transition-colors shadow-sm"
                            >
                                {course.access_tier === 'open'
                                    ? 'Start This Course — Free'
                                    : course.access_tier === 'registered'
                                        ? 'Register to Start — Free'
                                        : 'Subscribe to Access'}
                            </Link>
                            <p className="text-sm text-slate-500 pt-1">
                                {tier.description}
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ================================================================ */}
            {/* MODULES LIST                                                     */}
            {/* ================================================================ */}
            <section className="py-16">
                <div className="container mx-auto px-6">
                    <div className="max-w-4xl">
                        <h2 className="text-2xl font-bold text-slate-800 mb-2">
                            Course Modules
                        </h2>
                        <p className="text-slate-600 mb-8">
                            Work through each module in order. Every module
                            combines theory, worked examples, and hands-on
                            practice.
                        </p>

                        <div className="space-y-3">
                            {modules.map((module, index) => (
                                <Link
                                    key={module.module_id}
                                    href={`/course/${course.slug}/${module.slug}`}
                                    className="group block bg-white rounded-xl border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all p-5"
                                >
                                    <div className="flex items-start gap-4">
                                        {/* Module number indicator */}
                                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-100 group-hover:bg-emerald-100 flex items-center justify-center transition-colors">
                                            <span className="text-sm font-bold text-slate-500 group-hover:text-emerald-600 transition-colors">
                                                {index + 1}
                                            </span>
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-4">
                                                <div>
                                                    <h3 className="font-semibold text-slate-800 group-hover:text-emerald-700 transition-colors">
                                                        {module.title}
                                                    </h3>
                                                    {module.description && (
                                                        <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                                                            {module.description}
                                                        </p>
                                                    )}
                                                </div>
                                                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-emerald-500 flex-shrink-0 mt-0.5 transition-colors" />
                                            </div>

                                            {/* Module meta */}
                                            <div className="flex items-center gap-4 mt-3">
                                                {module.estimated_minutes && (
                                                    <div className="flex items-center gap-1 text-xs text-slate-500">
                                                        <Clock className="w-3.5 h-3.5" />
                                                        <span>{module.estimated_minutes} min</span>
                                                    </div>
                                                )}
                                                {module.lesson_count > 0 && (
                                                    <div className="flex items-center gap-1 text-xs text-slate-500">
                                                        <BookOpen className="w-3.5 h-3.5" />
                                                        <span>{module.lesson_count} lessons</span>
                                                    </div>
                                                )}
                                                {module.is_free_preview && (
                                                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-medium">
                                                        Free Preview
                                                    </span>
                                                )}
                                            </div>

                                            {/* Learning objectives */}
                                            {module.learning_objectives &&
                                                module.learning_objectives.length > 0 && (
                                                    <div className="mt-3 pt-3 border-t border-slate-100">
                                                        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-2">
                                                            <Target className="w-3.5 h-3.5" />
                                                            <span>Learning objectives</span>
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {module.learning_objectives.map(
                                                                (objective, i) => (
                                                                    <span
                                                                        key={i}
                                                                        className="text-xs text-slate-600 bg-slate-50 px-2 py-1 rounded"
                                                                    >
                                                                        {objective}
                                                                    </span>
                                                                )
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                        </div>
                                    </div>
                                </Link>
                            ))}

                            {modules.length === 0 && (
                                <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                                    <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-4" />
                                    <p className="text-slate-600 font-medium">
                                        Modules are being prepared
                                    </p>
                                    <p className="text-sm text-slate-500 mt-1">
                                        Course content is currently in development.
                                        Register to be notified when it launches.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* ================================================================ */}
            {/* CERTIFICATION EARNED                                             */}
            {/* ================================================================ */}
            {course.certification_name && (
                <section className="py-12 bg-white border-t border-slate-200">
                    <div className="container mx-auto px-6">
                        <div className="max-w-4xl">
                            <div className={`flex items-center gap-5 p-6 rounded-xl border-2 ${certColour.border} ${certColour.bg}`}>
                                <div className="flex-shrink-0">
                                    <div className={`w-14 h-14 rounded-full bg-white flex items-center justify-center border-2 ${certColour.border}`}>
                                        <Award className={`w-7 h-7 ${certColour.text}`} />
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-slate-800 text-lg">
                                        {course.certification_name}
                                    </h3>
                                    <p className="text-sm text-slate-600 mt-1">
                                        Complete all modules in this course to earn
                                        your {course.certification_name}. A verifiable
                                        credential you can share professionally and
                                        include in your CPD record.
                                    </p>
                                </div>
                                <div className="flex-shrink-0 hidden md:flex items-center gap-2 text-sm text-slate-500">
                                    <Clock className="w-4 h-4" />
                                    <span>{course.estimated_hours} CPD hours</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* ================================================================ */}
            {/* BOTTOM CTA                                                       */}
            {/* ================================================================ */}
            <section className="py-12 bg-slate-50 border-t border-slate-200">
                <div className="container mx-auto px-6">
                    <div className="max-w-4xl text-center mx-auto">
                        <h2 className="text-2xl font-bold text-slate-800 mb-3">
                            Ready to begin?
                        </h2>
                        <p className="text-slate-600 mb-6">
                            {course.access_tier === 'open'
                                ? 'This course is free and open to everyone. Start learning now.'
                                : course.access_tier === 'registered'
                                    ? 'Register for a free account to access this course and track your progress.'
                                    : 'Subscribe to the Clarence platform to access this course and the full Academy.'}
                        </p>
                        <Link
                            href="/auth/register"
                            className="inline-block px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-base font-semibold transition-colors shadow-sm"
                        >
                            {course.access_tier === 'open'
                                ? 'Start Learning — Free'
                                : course.access_tier === 'registered'
                                    ? 'Register — Free'
                                    : 'View Subscription Options'}
                        </Link>
                    </div>
                </div>
            </section>

            {/* ================================================================ */}
            {/* COURSE NAVIGATION (PREV / NEXT)                                  */}
            {/* ================================================================ */}
            <section className="py-8 bg-white border-t border-slate-200">
                <div className="container mx-auto px-6">
                    <div className="max-w-4xl flex items-center justify-between">
                        {adjacent.prev ? (
                            <Link
                                href={`/course/${adjacent.prev.slug}`}
                                className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-emerald-700 transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                <div>
                                    <div className="text-xs text-slate-400">Previous course</div>
                                    <div>{adjacent.prev.title}</div>
                                </div>
                            </Link>
                        ) : (
                            <div />
                        )}

                        {adjacent.next ? (
                            <Link
                                href={`/course/${adjacent.next.slug}`}
                                className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-emerald-700 transition-colors text-right"
                            >
                                <div>
                                    <div className="text-xs text-slate-400">Next course</div>
                                    <div>{adjacent.next.title}</div>
                                </div>
                                <ArrowRight className="w-4 h-4" />
                            </Link>
                        ) : (
                            <div />
                        )}
                    </div>
                </div>
            </section>

            {/* ================================================================ */}
            {/* FOOTER                                                           */}
            {/* ================================================================ */}
            <footer className="bg-slate-800 py-8">
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