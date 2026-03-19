// ============================================================================
// CLARENCE ACADEMY — LANDING PAGE
// ============================================================================
// File: app/academy/page.tsx (served at academy.clarencelegal.ai via Vercel)
//
// Server component — fetches courses from Supabase at request time.
// Matches clarencelegal.ai design language: slate/emerald/violet palette,
// Tailwind CSS, Lucide React icons.
//
// Sections:
//   1. Navigation (Academy-specific)
//   2. Hero — Institution-first messaging
//   3. Course Catalogue — Dynamic from academy_courses table
//   4. How It Works — Enrol → Learn → Practise → Certify
//   5. Certification — 5 levels with CPD hours
//   6. CTA — Enrolment prompt
//   7. Footer
// ============================================================================

import type { ReactNode } from 'react'
import { Metadata } from 'next'
import Link from 'next/link'
import { createServiceRoleClient } from '@/lib/supabase'
import {
    ArrowRight,
    BookOpen,
    Award,
    GraduationCap,
    Shield,
    Clock,
    Lock,
    Globe,
    UserPlus,
} from 'lucide-react'

export const metadata: Metadata = {
    title: 'Clarence Academy | Professional Excellence in Principled Negotiation',
    description:
        'A structured training programme in principled negotiation methodology. Open to everyone. Certification on completion. CPD-aligned professional development.',
    openGraph: {
        title: 'Clarence Academy | Professional Excellence in Principled Negotiation',
        description:
            'Master the methodology of principled negotiation. Structured courses, real-world practice, and professional certification.',
        siteName: 'Clarence Academy',
        type: 'website',
    },
}

// ============================================================================
// TYPES
// ============================================================================

interface AcademyCourse {
    course_id: string
    title: string
    slug: string
    short_description: string
    icon: string
    access_tier: 'open' | 'registered' | 'subscriber'
    display_order: number
    estimated_hours: number
    module_count: number
    certification_name: string
    certification_level: string
}

// ============================================================================
// ACCESS TIER CONFIG
// ============================================================================

const ACCESS_TIERS: Record<string, { label: string; icon: ReactNode; color: string; bg: string }> = {
    open: {
        label: 'Free Access',
        icon: <Globe className="w-3.5 h-3.5" />,
        color: 'text-emerald-700',
        bg: 'bg-emerald-50 border-emerald-200',
    },
    registered: {
        label: 'Free Registration',
        icon: <UserPlus className="w-3.5 h-3.5" />,
        color: 'text-blue-700',
        bg: 'bg-blue-50 border-blue-200',
    },
    subscriber: {
        label: 'Subscriber',
        icon: <Lock className="w-3.5 h-3.5" />,
        color: 'text-violet-700',
        bg: 'bg-violet-50 border-violet-200',
    },
}

// ============================================================================
// CERTIFICATION LEVELS
// ============================================================================

const CERTIFICATIONS = [
    {
        level: 'foundations',
        name: 'Clarence Foundations Certificate',
        requires: 'Course 1: Foundations',
        hours: '3–4 hours',
        color: 'border-emerald-300 bg-emerald-50',
        iconColor: 'text-emerald-600',
    },
    {
        level: 'practitioner',
        name: 'Clarence Platform Practitioner',
        requires: 'Courses 2 + 3: Getting Started & QC Masterclass',
        hours: '5–6 hours',
        color: 'border-blue-300 bg-blue-50',
        iconColor: 'text-blue-600',
    },
    {
        level: 'specialist',
        name: 'Clarence Negotiation Specialist',
        requires: 'Course 4: Leverage Negotiation',
        hours: '6–8 hours',
        color: 'border-amber-300 bg-amber-50',
        iconColor: 'text-amber-600',
    },
    {
        level: 'compliance',
        name: 'Clarence Risk & Compliance Practitioner',
        requires: 'Course 5: Playbooks',
        hours: '4–5 hours',
        color: 'border-violet-300 bg-violet-50',
        iconColor: 'text-violet-600',
    },
    {
        level: 'master',
        name: 'Clarence Master Negotiator',
        requires: 'All courses + minimum B grade average',
        hours: '25–30 hours total',
        color: 'border-slate-400 bg-slate-50',
        iconColor: 'text-slate-700',
    },
]

// ============================================================================
// DATA FETCHING
// ============================================================================

async function getCourses(): Promise<AcademyCourse[]> {
    const supabase = createServiceRoleClient()

    const { data, error } = await supabase
        .from('academy_courses')
        .select(
            'course_id, title, slug, short_description, icon, access_tier, display_order, estimated_hours, module_count, certification_name, certification_level'
        )
        .eq('status', 'published')
        .eq('is_active', true)
        .order('display_order', { ascending: true })

    if (error) {
        console.error('Error fetching courses:', error)
        return []
    }

    return data || []
}

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default async function AcademyLandingPage() {
    const courses = await getCourses()

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
                                <span className="text-xl font-bold text-slate-800">
                                    CLARENCE
                                </span>
                            </Link>
                            <span className="text-slate-300 font-light">|</span>
                            <span className="text-lg font-semibold text-slate-600">
                                Academy
                            </span>
                        </div>

                        <nav className="hidden md:flex items-center gap-6">
                            <a
                                href="#courses"
                                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                            >
                                Courses
                            </a>
                            <a
                                href="#how-it-works"
                                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                            >
                                How It Works
                            </a>
                            <a
                                href="#certification"
                                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                            >
                                Certification
                            </a>
                            <Link
                                href="https://clarencelegal.ai"
                                className="text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
                            >
                                Platform
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
            {/* HERO SECTION                                                     */}
            {/* ================================================================ */}
            <section className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-emerald-50/30"></div>
                <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-violet-50/50 to-transparent"></div>

                <div className="relative container mx-auto px-6 py-24 md:py-32">
                    <div className="max-w-4xl mx-auto text-center">
                        {/* Badge */}
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-full text-sm font-medium mb-8">
                            <GraduationCap className="w-4 h-4" />
                            <span>Professional Development & Certification</span>
                        </div>

                        {/* Headline */}
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 tracking-tight text-slate-800">
                            Master the methodology of{' '}
                            <span className="text-emerald-600">
                                principled negotiation
                            </span>
                        </h1>

                        {/* Subtitle */}
                        <p className="text-lg md:text-xl text-slate-600 mb-4 max-w-2xl mx-auto leading-relaxed">
                            A structured training programme that teaches you how to
                            create better agreements — not through adversarial tactics,
                            but through principled methodology that changes outcomes.
                        </p>

                        <p className="text-base text-slate-500 mb-10 max-w-2xl mx-auto">
                            Open to everyone. No subscription required.
                            Professional certification on completion.
                        </p>

                        {/* CTA Buttons */}
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
                            <Link
                                href="/auth/register"
                                className="px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-base font-semibold transition-colors shadow-sm"
                            >
                                Start Learning — Free
                            </Link>
                            <a
                                href="#courses"
                                className="px-8 py-4 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-base font-semibold transition-colors border border-slate-200"
                            >
                                View All Courses
                            </a>
                        </div>

                        {/* Trust indicators */}
                        <div className="flex items-center justify-center gap-8 text-sm text-slate-500 flex-wrap">
                            <div className="flex items-center gap-2">
                                <BookOpen className="w-4 h-4 text-emerald-500" />
                                <span>{courses.length} structured courses</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Award className="w-4 h-4 text-emerald-500" />
                                <span>Professional certification</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-emerald-500" />
                                <span>CPD-aligned hours</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ================================================================ */}
            {/* COURSE CATALOGUE                                                 */}
            {/* ================================================================ */}
            <section id="courses" className="py-20 bg-white border-t border-slate-200">
                <div className="container mx-auto px-6">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold text-slate-800 mb-4">
                            The Curriculum
                        </h2>
                        <p className="text-slate-600 max-w-2xl mx-auto">
                            Seven courses that take you from foundational principles
                            to advanced strategy. Each course combines theory, worked
                            examples, and hands-on practice in the Training Studio.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
                        {courses.map((course) => {
                            const tier = ACCESS_TIERS[course.access_tier]
                            return (
                                <Link
                                    key={course.course_id}
                                    href={`/course/${course.slug}`}
                                    className="group bg-white rounded-xl border border-slate-200 hover:border-emerald-300 hover:shadow-lg transition-all p-6 flex flex-col"
                                >
                                    {/* Icon & Order */}
                                    <div className="flex items-start justify-between mb-4">
                                        <span className="text-3xl">
                                            {course.icon}
                                        </span>
                                        <span className="text-xs font-medium text-slate-400">
                                            Course {course.display_order}
                                        </span>
                                    </div>

                                    {/* Title */}
                                    <h3 className="text-lg font-bold text-slate-800 mb-2 group-hover:text-emerald-700 transition-colors">
                                        {course.title}
                                    </h3>

                                    {/* Description */}
                                    <p className="text-sm text-slate-600 mb-4 flex-1">
                                        {course.short_description}
                                    </p>

                                    {/* Meta row */}
                                    <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                                        <div className="flex items-center gap-3">
                                            {/* Duration */}
                                            <div className="flex items-center gap-1 text-xs text-slate-500">
                                                <Clock className="w-3.5 h-3.5" />
                                                <span>
                                                    {course.estimated_hours}h
                                                </span>
                                            </div>
                                            {/* Modules */}
                                            {course.module_count > 0 && (
                                                <div className="flex items-center gap-1 text-xs text-slate-500">
                                                    <BookOpen className="w-3.5 h-3.5" />
                                                    <span>
                                                        {course.module_count}{' '}
                                                        modules
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Access tier badge */}
                                        <div
                                            className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${tier.bg} ${tier.color}`}
                                        >
                                            {tier.icon}
                                            <span>{tier.label}</span>
                                        </div>
                                    </div>
                                </Link>
                            )
                        })}
                    </div>
                </div>
            </section>

            {/* ================================================================ */}
            {/* HOW IT WORKS                                                     */}
            {/* ================================================================ */}
            <section
                id="how-it-works"
                className="py-20 bg-slate-50 border-t border-slate-200"
            >
                <div className="container mx-auto px-6">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold text-slate-800 mb-4">
                            How the Academy Works
                        </h2>
                        <p className="text-slate-600 max-w-2xl mx-auto">
                            Every course follows the same structured approach:
                            learn the theory, see it applied, then practise it
                            yourself in the Training Studio.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-5xl mx-auto">
                        {/* Step 1 */}
                        <div className="text-center">
                            <div className="w-14 h-14 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                                <UserPlus className="w-6 h-6 text-emerald-600" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 mb-2">
                                Enrol
                            </h3>
                            <p className="text-sm text-slate-600">
                                Choose your course and register. The Foundations
                                course is completely free — no subscription, no
                                commitment, no credit card.
                            </p>
                        </div>

                        {/* Step 2 */}
                        <div className="text-center">
                            <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                                <BookOpen className="w-6 h-6 text-blue-600" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 mb-2">
                                Learn
                            </h3>
                            <p className="text-sm text-slate-600">
                                Work through structured modules at your own pace.
                                Each module combines video theory, worked examples,
                                and written context material.
                            </p>
                        </div>

                        {/* Step 3 */}
                        <div className="text-center">
                            <div className="w-14 h-14 bg-amber-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                                <Shield className="w-6 h-6 text-amber-600" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 mb-2">
                                Practise
                            </h3>
                            <p className="text-sm text-slate-600">
                                Apply what you have learned in the Training Studio.
                                Negotiate against AI opponents calibrated to your
                                skill level with scored debriefs.
                            </p>
                        </div>

                        {/* Step 4 */}
                        <div className="text-center">
                            <div className="w-14 h-14 bg-violet-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                                <Award className="w-6 h-6 text-violet-600" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 mb-2">
                                Certify
                            </h3>
                            <p className="text-sm text-slate-600">
                                Complete the course and earn a Clarence certification.
                                Verifiable credentials you can share on LinkedIn,
                                include in your CV, and reference professionally.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ================================================================ */}
            {/* CERTIFICATION                                                    */}
            {/* ================================================================ */}
            <section
                id="certification"
                className="py-20 bg-white border-t border-slate-200"
            >
                <div className="container mx-auto px-6">
                    <div className="text-center mb-12">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-800 text-white rounded-full text-sm font-medium mb-4">
                            <Award className="w-4 h-4" />
                            <span>Professional Certification</span>
                        </div>
                        <h2 className="text-3xl font-bold text-slate-800 mb-4">
                            Five Levels of Certification
                        </h2>
                        <p className="text-slate-600 max-w-2xl mx-auto">
                            Each certification requires genuine engagement — not
                            simply clicking through videos. Assessment, reflection,
                            and demonstrated understanding are part of the
                            completion criteria.
                        </p>
                    </div>

                    <div className="max-w-3xl mx-auto space-y-4">
                        {CERTIFICATIONS.map((cert, index) => (
                            <div
                                key={cert.level}
                                className={`flex items-center gap-4 p-5 rounded-xl border-2 ${cert.color} transition-all hover:shadow-sm`}
                            >
                                <div className="flex-shrink-0">
                                    <div
                                        className={`w-10 h-10 rounded-full flex items-center justify-center bg-white border-2 ${cert.color.split(' ')[0]}`}
                                    >
                                        <span
                                            className={`text-sm font-bold ${cert.iconColor}`}
                                        >
                                            {index + 1}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-slate-800">
                                        {cert.name}
                                    </h3>
                                    <p className="text-sm text-slate-600">
                                        {cert.requires}
                                    </p>
                                </div>
                                <div className="flex-shrink-0 text-right">
                                    <div className="flex items-center gap-1 text-sm text-slate-500">
                                        <Clock className="w-4 h-4" />
                                        <span>{cert.hours}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="text-center mt-8">
                        <p className="text-sm text-slate-500 max-w-lg mx-auto">
                            All certifications are verifiable online and designed
                            to align with CPD frameworks. Formal SRA/CILEx
                            accreditation is being pursued.
                        </p>
                    </div>
                </div>
            </section>

            {/* ================================================================ */}
            {/* PRINCIPLES BAR                                                   */}
            {/* ================================================================ */}
            <section className="py-12 bg-slate-800">
                <div className="container mx-auto px-6">
                    <div className="max-w-4xl mx-auto text-center">
                        <div className="flex items-center justify-center gap-4 md:gap-8 mb-4">
                            <span className="text-xl md:text-2xl font-bold text-emerald-400">
                                Learn
                            </span>
                            <span className="text-slate-600 text-xl font-light">
                                ·
                            </span>
                            <span className="text-xl md:text-2xl font-bold text-slate-300">
                                Practise
                            </span>
                            <span className="text-slate-600 text-xl font-light">
                                ·
                            </span>
                            <span className="text-xl md:text-2xl font-bold text-violet-400">
                                Certify
                            </span>
                        </div>
                        <p className="text-slate-400 text-sm max-w-xl mx-auto">
                            The Clarence Academy is not a course bolted onto a
                            product. It is the foundation of a professional
                            standard for principled negotiation.
                        </p>
                    </div>
                </div>
            </section>

            {/* ================================================================ */}
            {/* CTA SECTION                                                      */}
            {/* ================================================================ */}
            <section className="py-20 bg-slate-50 border-t border-slate-200">
                <div className="container mx-auto px-6">
                    <div className="max-w-2xl mx-auto text-center">
                        <h2 className="text-3xl font-bold text-slate-800 mb-4">
                            Begin with the Foundation
                        </h2>
                        <p className="text-slate-600 mb-8">
                            The Foundations of Principled Negotiation course is
                            free and open to everyone. No platform subscription,
                            no trial period — just a structured introduction to
                            the methodology that is changing how agreements get
                            made.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Link
                                href="/auth/register"
                                className="px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-base font-semibold transition-colors shadow-sm"
                            >
                                Start the Foundations Course — Free
                            </Link>
                            <Link
                                href="https://clarencelegal.ai"
                                className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
                            >
                                Learn about the Clarence Platform
                                <ArrowRight className="w-4 h-4" />
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* ================================================================ */}
            {/* FOOTER                                                           */}
            {/* ================================================================ */}
            <footer className="bg-slate-800 py-12">
                <div className="container mx-auto px-6">
                    <div className="grid md:grid-cols-4 gap-8">
                        {/* Brand */}
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-7 h-7 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-md flex items-center justify-center">
                                    <span className="text-white text-xs font-bold">
                                        C
                                    </span>
                                </div>
                                <span className="text-lg font-bold text-white">
                                    CLARENCE
                                </span>
                                <span className="text-slate-500 font-light">
                                    |
                                </span>
                                <span className="text-sm font-medium text-slate-400">
                                    Academy
                                </span>
                            </div>
                            <p className="text-sm text-slate-400">
                                Professional excellence in principled negotiation.
                                A Clarence Legal Limited initiative.
                            </p>
                        </div>

                        {/* Courses */}
                        <div>
                            <h4 className="text-sm font-semibold text-slate-300 mb-4">
                                Courses
                            </h4>
                            <ul className="space-y-2">
                                {courses.slice(0, 4).map((course) => (
                                    <li key={course.course_id}>
                                        <Link
                                            href={`/course/${course.slug}`}
                                            className="text-sm text-slate-400 hover:text-white transition-colors"
                                        >
                                            {course.title}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* More Courses */}
                        <div>
                            <h4 className="text-sm font-semibold text-slate-300 mb-4">
                                Advanced
                            </h4>
                            <ul className="space-y-2">
                                {courses.slice(4).map((course) => (
                                    <li key={course.course_id}>
                                        <Link
                                            href={`/course/${course.slug}`}
                                            className="text-sm text-slate-400 hover:text-white transition-colors"
                                        >
                                            {course.title}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Links */}
                        <div>
                            <h4 className="text-sm font-semibold text-slate-300 mb-4">
                                Clarence
                            </h4>
                            <ul className="space-y-2">
                                <li>
                                    <Link
                                        href="https://clarencelegal.ai"
                                        className="text-sm text-slate-400 hover:text-white transition-colors"
                                    >
                                        Platform
                                    </Link>
                                </li>
                                <li>
                                    <Link
                                        href="https://clarencelegal.ai/products"
                                        className="text-sm text-slate-400 hover:text-white transition-colors"
                                    >
                                        Products
                                    </Link>
                                </li>
                                <li>
                                    <Link
                                        href="https://clarencelegal.ai/enterprise"
                                        className="text-sm text-slate-400 hover:text-white transition-colors"
                                    >
                                        Enterprise
                                    </Link>
                                </li>
                                <li>
                                    <Link
                                        href="https://clarencelegal.ai/request-trial"
                                        className="text-sm text-slate-400 hover:text-white transition-colors"
                                    >
                                        Request Trial
                                    </Link>
                                </li>
                            </ul>
                        </div>
                    </div>

                    <div className="mt-10 pt-6 border-t border-slate-700 flex flex-col md:flex-row items-center justify-between gap-4">
                        <p className="text-xs text-slate-500">
                            &copy; {new Date().getFullYear()} Clarence Legal
                            Limited. All rights reserved.
                        </p>
                        <p className="text-xs text-slate-500">
                            The Honest Broker
                        </p>
                    </div>
                </div>
            </footer>
        </main>
    )
}
