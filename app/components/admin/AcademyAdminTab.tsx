// ============================================================================
// CLARENCE ACADEMY — ADMIN COMPONENT
// ============================================================================
// File: app/components/admin/AcademyAdminTab.tsx
//
// Drop this into the beta-testing admin page as a new tab.
// Provides full CRUD for courses, modules, and lessons with reordering.
//
// Usage in beta-testing page.tsx:
//   1. Import: import AcademyAdminTab from '@/components/admin/AcademyAdminTab'
//   2. Add tab button for 'academy' in the tab nav
//   3. Render: {activeTab === 'academy' && <AcademyAdminTab />}
//
// NOTE: Uses createClient() from @/lib/supabase (client-side)
// ============================================================================

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

// ============================================================================
// TYPES
// ============================================================================

interface Course {
    course_id: string
    title: string
    slug: string
    description: string | null
    short_description: string | null
    icon: string | null
    access_tier: string
    display_order: number
    estimated_hours: number | null
    module_count: number
    certification_name: string | null
    certification_level: string | null
    status: string
    is_active: boolean
    created_at: string
    updated_at: string
}

interface Module {
    module_id: string
    course_id: string
    title: string
    slug: string
    description: string | null
    learning_objectives: string[] | null
    display_order: number
    estimated_minutes: number | null
    lesson_count: number
    status: string
    is_active: boolean
    is_free_preview: boolean
    created_at: string
}

interface Lesson {
    lesson_id: string
    module_id: string
    title: string
    slug: string
    lesson_type: string
    display_order: number
    estimated_minutes: number | null
    video_id: string | null
    content_html: string | null
    content_markdown: string | null
    exercise_url: string | null
    resource_url: string | null
    resource_filename: string | null
    is_required: boolean
    is_active: boolean
    status: string
    created_at: string
}

// ============================================================================
// CONSTANTS
// ============================================================================

const ACCESS_TIERS = [
    { value: 'open', label: 'Free Access', color: 'bg-emerald-100 text-emerald-700' },
    { value: 'registered', label: 'Free Registration', color: 'bg-blue-100 text-blue-700' },
    { value: 'subscriber', label: 'Subscriber', color: 'bg-violet-100 text-violet-700' },
]

const STATUSES = [
    { value: 'draft', label: 'Draft', color: 'bg-slate-100 text-slate-600' },
    { value: 'published', label: 'Published', color: 'bg-emerald-100 text-emerald-700' },
    { value: 'archived', label: 'Archived', color: 'bg-red-100 text-red-700' },
]

const CERT_LEVELS = [
    { value: 'foundations', label: 'Foundations' },
    { value: 'practitioner', label: 'Practitioner' },
    { value: 'specialist', label: 'Specialist' },
    { value: 'compliance', label: 'Compliance' },
    { value: 'master', label: 'Master' },
]

const LESSON_TYPES = [
    { value: 'video', label: 'Video', icon: '🎬' },
    { value: 'context', label: 'Reading', icon: '📖' },
    { value: 'exercise', label: 'Exercise', icon: '🏋️' },
    { value: 'assessment', label: 'Assessment', icon: '📝' },
    { value: 'resource', label: 'Resource', icon: '📁' },
]

// ============================================================================
// HELPER: Generate slug from title
// ============================================================================

function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim()
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function AcademyAdminTab() {
    const supabase = createClient()

    // ── View state ──
    const [view, setView] = useState<'courses' | 'modules' | 'lessons'>('courses')
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
    const [selectedModule, setSelectedModule] = useState<Module | null>(null)

    // ── Data state ──
    const [courses, setCourses] = useState<Course[]>([])
    const [modules, setModules] = useState<Module[]>([])
    const [lessons, setLessons] = useState<Lesson[]>([])
    const [loading, setLoading] = useState(false)

    // ── Modal state ──
    const [showModal, setShowModal] = useState(false)
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    // ── Form state ──
    const [courseForm, setCourseForm] = useState({
        title: '', slug: '', description: '', short_description: '',
        icon: '', access_tier: 'open', estimated_hours: '',
        certification_name: '', certification_level: 'foundations',
        status: 'draft',
    })
    const [moduleForm, setModuleForm] = useState({
        title: '', slug: '', description: '',
        learning_objectives: '',  // comma-separated, parsed on save
        estimated_minutes: '', status: 'draft', is_free_preview: false,
    })
    const [lessonForm, setLessonForm] = useState({
        title: '', slug: '', lesson_type: 'video',
        estimated_minutes: '', content_html: '', content_markdown: '',
        exercise_url: '', resource_url: '', resource_filename: '',
        is_required: true, status: 'draft',
    })

    // ── Edit tracking ──
    const [editingId, setEditingId] = useState<string | null>(null)

    // ── Load data ──
    useEffect(() => { loadCourses() }, [])

    // ========================================================================
    // DATA LOADING
    // ========================================================================

    async function loadCourses() {
        setLoading(true)
        const { data, error } = await supabase
            .from('academy_courses')
            .select('*')
            .order('display_order', { ascending: true })
        if (!error) setCourses(data || [])
        setLoading(false)
    }

    async function loadModules(courseId: string) {
        setLoading(true)
        const { data, error } = await supabase
            .from('academy_modules')
            .select('*')
            .eq('course_id', courseId)
            .order('display_order', { ascending: true })
        if (!error) setModules(data || [])
        setLoading(false)
    }

    async function loadLessons(moduleId: string) {
        setLoading(true)
        const { data, error } = await supabase
            .from('academy_lessons')
            .select('*')
            .eq('module_id', moduleId)
            .order('display_order', { ascending: true })
        if (!error) setLessons(data || [])
        setLoading(false)
    }

    // ========================================================================
    // COURSE CRUD
    // ========================================================================

    function openCreateCourse() {
        setCourseForm({
            title: '', slug: '', description: '', short_description: '',
            icon: '', access_tier: 'open', estimated_hours: '',
            certification_name: '', certification_level: 'foundations',
            status: 'draft',
        })
        setEditingId(null)
        setModalMode('create')
        setShowModal(true)
    }

    function openEditCourse(course: Course) {
        setCourseForm({
            title: course.title,
            slug: course.slug,
            description: course.description || '',
            short_description: course.short_description || '',
            icon: course.icon || '',
            access_tier: course.access_tier,
            estimated_hours: course.estimated_hours?.toString() || '',
            certification_name: course.certification_name || '',
            certification_level: course.certification_level || 'foundations',
            status: course.status,
        })
        setEditingId(course.course_id)
        setModalMode('edit')
        setShowModal(true)
    }

    async function saveCourse() {
        setSaving(true)
        setMessage(null)

        const payload: any = {
            title: courseForm.title,
            slug: courseForm.slug || slugify(courseForm.title),
            description: courseForm.description || null,
            short_description: courseForm.short_description || null,
            icon: courseForm.icon || null,
            access_tier: courseForm.access_tier,
            estimated_hours: courseForm.estimated_hours ? parseFloat(courseForm.estimated_hours) : null,
            certification_name: courseForm.certification_name || null,
            certification_level: courseForm.certification_level || null,
            status: courseForm.status,
        }

        try {
            if (modalMode === 'create') {
                payload.display_order = courses.length + 1
                const { error } = await supabase.from('academy_courses').insert(payload)
                if (error) throw error
                setMessage({ type: 'success', text: 'Course created' })
            } else {
                const { error } = await supabase
                    .from('academy_courses')
                    .update(payload)
                    .eq('course_id', editingId)
                if (error) throw error
                setMessage({ type: 'success', text: 'Course updated' })
            }
            setShowModal(false)
            loadCourses()
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Failed to save course' })
        } finally {
            setSaving(false)
        }
    }

    async function toggleCourseStatus(course: Course) {
        const newStatus = course.status === 'published' ? 'draft' : 'published'
        await supabase
            .from('academy_courses')
            .update({ status: newStatus })
            .eq('course_id', course.course_id)
        loadCourses()
    }

    async function moveCourse(courseId: string, direction: 'up' | 'down') {
        const index = courses.findIndex(c => c.course_id === courseId)
        if (direction === 'up' && index <= 0) return
        if (direction === 'down' && index >= courses.length - 1) return

        const swapIndex = direction === 'up' ? index - 1 : index + 1
        const currentOrder = courses[index].display_order
        const swapOrder = courses[swapIndex].display_order

        await Promise.all([
            supabase.from('academy_courses').update({ display_order: swapOrder }).eq('course_id', courses[index].course_id),
            supabase.from('academy_courses').update({ display_order: currentOrder }).eq('course_id', courses[swapIndex].course_id),
        ])
        loadCourses()
    }

    // ========================================================================
    // MODULE CRUD
    // ========================================================================

    function openCreateModule() {
        setModuleForm({
            title: '', slug: '', description: '',
            learning_objectives: '', estimated_minutes: '',
            status: 'draft', is_free_preview: false,
        })
        setEditingId(null)
        setModalMode('create')
        setShowModal(true)
    }

    function openEditModule(mod: Module) {
        setModuleForm({
            title: mod.title,
            slug: mod.slug,
            description: mod.description || '',
            learning_objectives: mod.learning_objectives?.join(', ') || '',
            estimated_minutes: mod.estimated_minutes?.toString() || '',
            status: mod.status,
            is_free_preview: mod.is_free_preview,
        })
        setEditingId(mod.module_id)
        setModalMode('edit')
        setShowModal(true)
    }

    async function saveModule() {
        if (!selectedCourse) return
        setSaving(true)
        setMessage(null)

        const objectives = moduleForm.learning_objectives
            ? moduleForm.learning_objectives.split(',').map(s => s.trim()).filter(Boolean)
            : null

        const payload: any = {
            title: moduleForm.title,
            slug: moduleForm.slug || slugify(moduleForm.title),
            description: moduleForm.description || null,
            learning_objectives: objectives,
            estimated_minutes: moduleForm.estimated_minutes ? parseInt(moduleForm.estimated_minutes) : null,
            status: moduleForm.status,
            is_free_preview: moduleForm.is_free_preview,
        }

        try {
            if (modalMode === 'create') {
                payload.course_id = selectedCourse.course_id
                payload.display_order = modules.length + 1
                const { error } = await supabase.from('academy_modules').insert(payload)
                if (error) throw error
                setMessage({ type: 'success', text: 'Module created' })
            } else {
                const { error } = await supabase
                    .from('academy_modules')
                    .update(payload)
                    .eq('module_id', editingId)
                if (error) throw error
                setMessage({ type: 'success', text: 'Module updated' })
            }
            setShowModal(false)
            loadModules(selectedCourse.course_id)
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Failed to save module' })
        } finally {
            setSaving(false)
        }
    }

    async function moveModule(moduleId: string, direction: 'up' | 'down') {
        const index = modules.findIndex(m => m.module_id === moduleId)
        if (direction === 'up' && index <= 0) return
        if (direction === 'down' && index >= modules.length - 1) return

        const swapIndex = direction === 'up' ? index - 1 : index + 1
        const currentOrder = modules[index].display_order
        const swapOrder = modules[swapIndex].display_order

        await Promise.all([
            supabase.from('academy_modules').update({ display_order: swapOrder }).eq('module_id', modules[index].module_id),
            supabase.from('academy_modules').update({ display_order: currentOrder }).eq('module_id', modules[swapIndex].module_id),
        ])
        if (selectedCourse) loadModules(selectedCourse.course_id)
    }

    // ========================================================================
    // LESSON CRUD
    // ========================================================================

    function openCreateLesson() {
        setLessonForm({
            title: '', slug: '', lesson_type: 'video',
            estimated_minutes: '', content_html: '', content_markdown: '',
            exercise_url: '', resource_url: '', resource_filename: '',
            is_required: true, status: 'draft',
        })
        setEditingId(null)
        setModalMode('create')
        setShowModal(true)
    }

    function openEditLesson(lesson: Lesson) {
        setLessonForm({
            title: lesson.title,
            slug: lesson.slug,
            lesson_type: lesson.lesson_type,
            estimated_minutes: lesson.estimated_minutes?.toString() || '',
            content_html: lesson.content_html || '',
            content_markdown: lesson.content_markdown || '',
            exercise_url: lesson.exercise_url || '',
            resource_url: lesson.resource_url || '',
            resource_filename: lesson.resource_filename || '',
            is_required: lesson.is_required,
            status: lesson.status,
        })
        setEditingId(lesson.lesson_id)
        setModalMode('edit')
        setShowModal(true)
    }

    async function saveLesson() {
        if (!selectedModule) return
        setSaving(true)
        setMessage(null)

        const payload: any = {
            title: lessonForm.title,
            slug: lessonForm.slug || slugify(lessonForm.title),
            lesson_type: lessonForm.lesson_type,
            estimated_minutes: lessonForm.estimated_minutes ? parseInt(lessonForm.estimated_minutes) : null,
            content_html: lessonForm.content_html || null,
            content_markdown: lessonForm.content_markdown || null,
            exercise_url: lessonForm.exercise_url || null,
            resource_url: lessonForm.resource_url || null,
            resource_filename: lessonForm.resource_filename || null,
            is_required: lessonForm.is_required,
            status: lessonForm.status,
        }

        try {
            if (modalMode === 'create') {
                payload.module_id = selectedModule.module_id
                payload.display_order = lessons.length + 1
                const { error } = await supabase.from('academy_lessons').insert(payload)
                if (error) throw error
                setMessage({ type: 'success', text: 'Lesson created' })
            } else {
                const { error } = await supabase
                    .from('academy_lessons')
                    .update(payload)
                    .eq('lesson_id', editingId)
                if (error) throw error
                setMessage({ type: 'success', text: 'Lesson updated' })
            }
            setShowModal(false)
            loadLessons(selectedModule.module_id)
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Failed to save lesson' })
        } finally {
            setSaving(false)
        }
    }

    async function moveLesson(lessonId: string, direction: 'up' | 'down') {
        const index = lessons.findIndex(l => l.lesson_id === lessonId)
        if (direction === 'up' && index <= 0) return
        if (direction === 'down' && index >= lessons.length - 1) return

        const swapIndex = direction === 'up' ? index - 1 : index + 1
        const currentOrder = lessons[index].display_order
        const swapOrder = lessons[swapIndex].display_order

        await Promise.all([
            supabase.from('academy_lessons').update({ display_order: swapOrder }).eq('lesson_id', lessons[index].lesson_id),
            supabase.from('academy_lessons').update({ display_order: currentOrder }).eq('lesson_id', lessons[swapIndex].lesson_id),
        ])
        if (selectedModule) loadLessons(selectedModule.module_id)
    }

    // ========================================================================
    // NAVIGATION
    // ========================================================================

    function navigateToCourse(course: Course) {
        setSelectedCourse(course)
        setSelectedModule(null)
        setView('modules')
        loadModules(course.course_id)
    }

    function navigateToModule(mod: Module) {
        setSelectedModule(mod)
        setView('lessons')
        loadLessons(mod.module_id)
    }

    function navigateBack() {
        if (view === 'lessons') {
            setSelectedModule(null)
            setView('modules')
        } else if (view === 'modules') {
            setSelectedCourse(null)
            setView('courses')
        }
    }

    // ========================================================================
    // RENDER
    // ========================================================================

    return (
        <div className="max-w-6xl mx-auto">
            {/* Status message */}
            {message && (
                <div className={`p-3 rounded-lg mb-4 text-sm font-medium ${message.type === 'success'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                    {message.type === 'success' ? '✅' : '❌'} {message.text}
                </div>
            )}

            {/* Breadcrumb navigation */}
            <div className="flex items-center gap-2 mb-6 text-sm">
                <button
                    onClick={() => { setView('courses'); setSelectedCourse(null); setSelectedModule(null) }}
                    className={`font-medium transition-colors ${view === 'courses' ? 'text-[#2563eb]' : 'text-slate-600 hover:text-slate-900'}`}
                >
                    🎓 Academy Courses
                </button>
                {selectedCourse && (
                    <>
                        <span className="text-slate-400">›</span>
                        <button
                            onClick={() => { setView('modules'); setSelectedModule(null) }}
                            className={`font-medium transition-colors ${view === 'modules' ? 'text-[#2563eb]' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            {selectedCourse.icon} {selectedCourse.title}
                        </button>
                    </>
                )}
                {selectedModule && (
                    <>
                        <span className="text-slate-400">›</span>
                        <span className="font-medium text-[#2563eb]">
                            {selectedModule.title}
                        </span>
                    </>
                )}
            </div>

            {/* ================================================================ */}
            {/* COURSES VIEW                                                     */}
            {/* ================================================================ */}
            {view === 'courses' && (
                <div>
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-slate-800">
                            Academy Courses ({courses.length})
                        </h2>
                        <button
                            onClick={openCreateCourse}
                            className="px-4 py-2 bg-[#2563eb] text-white rounded-lg font-medium hover:bg-[#1d4ed8]"
                        >
                            + Add Course
                        </button>
                    </div>

                    <div className="bg-white rounded-xl shadow overflow-hidden">
                        {loading ? (
                            <div className="p-12 text-center text-slate-500">Loading courses...</div>
                        ) : courses.length === 0 ? (
                            <div className="p-12 text-center text-slate-500">No courses yet</div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {courses.map((course, index) => (
                                    <div key={course.course_id} className="p-4 hover:bg-slate-50 flex items-center gap-4">
                                        {/* Reorder buttons */}
                                        <div className="flex flex-col gap-1">
                                            <button
                                                onClick={() => moveCourse(course.course_id, 'up')}
                                                disabled={index === 0}
                                                className="text-xs text-slate-400 hover:text-slate-600 disabled:opacity-30"
                                            >▲</button>
                                            <button
                                                onClick={() => moveCourse(course.course_id, 'down')}
                                                disabled={index === courses.length - 1}
                                                className="text-xs text-slate-400 hover:text-slate-600 disabled:opacity-30"
                                            >▼</button>
                                        </div>

                                        {/* Icon */}
                                        <span className="text-2xl">{course.icon || '📚'}</span>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-semibold text-slate-800">{course.title}</h3>
                                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUSES.find(s => s.value === course.status)?.color || ''
                                                    }`}>
                                                    {course.status}
                                                </span>
                                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${ACCESS_TIERS.find(t => t.value === course.access_tier)?.color || ''
                                                    }`}>
                                                    {ACCESS_TIERS.find(t => t.value === course.access_tier)?.label}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-500 line-clamp-1">
                                                {course.short_description || 'No description'}
                                            </p>
                                            <div className="flex items-center gap-4 mt-1 text-xs text-slate-400">
                                                <span>{course.module_count} modules</span>
                                                {course.estimated_hours && <span>{course.estimated_hours}h</span>}
                                                <span className="font-mono text-slate-300">/{course.slug}</span>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => navigateToCourse(course)}
                                                className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded text-sm font-medium hover:bg-blue-100"
                                            >
                                                Modules →
                                            </button>
                                            <button
                                                onClick={() => openEditCourse(course)}
                                                className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded text-sm font-medium hover:bg-slate-200"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => toggleCourseStatus(course)}
                                                className={`px-3 py-1.5 rounded text-sm font-medium ${course.status === 'published'
                                                        ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                                                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                                    }`}
                                            >
                                                {course.status === 'published' ? 'Unpublish' : 'Publish'}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ================================================================ */}
            {/* MODULES VIEW                                                     */}
            {/* ================================================================ */}
            {view === 'modules' && selectedCourse && (
                <div>
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <button onClick={navigateBack} className="text-sm text-slate-500 hover:text-slate-700 mb-1">
                                ← Back to Courses
                            </button>
                            <h2 className="text-xl font-bold text-slate-800">
                                {selectedCourse.icon} {selectedCourse.title} — Modules ({modules.length})
                            </h2>
                        </div>
                        <button
                            onClick={openCreateModule}
                            className="px-4 py-2 bg-[#2563eb] text-white rounded-lg font-medium hover:bg-[#1d4ed8]"
                        >
                            + Add Module
                        </button>
                    </div>

                    <div className="bg-white rounded-xl shadow overflow-hidden">
                        {loading ? (
                            <div className="p-12 text-center text-slate-500">Loading modules...</div>
                        ) : modules.length === 0 ? (
                            <div className="p-12 text-center text-slate-500">
                                <p className="text-lg mb-2">No modules yet</p>
                                <p className="text-sm">Add modules to build out this course.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {modules.map((mod, index) => (
                                    <div key={mod.module_id} className="p-4 hover:bg-slate-50 flex items-center gap-4">
                                        {/* Reorder */}
                                        <div className="flex flex-col gap-1">
                                            <button
                                                onClick={() => moveModule(mod.module_id, 'up')}
                                                disabled={index === 0}
                                                className="text-xs text-slate-400 hover:text-slate-600 disabled:opacity-30"
                                            >▲</button>
                                            <button
                                                onClick={() => moveModule(mod.module_id, 'down')}
                                                disabled={index === modules.length - 1}
                                                className="text-xs text-slate-400 hover:text-slate-600 disabled:opacity-30"
                                            >▼</button>
                                        </div>

                                        {/* Number */}
                                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-500">
                                            {index + 1}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-semibold text-slate-800">{mod.title}</h3>
                                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUSES.find(s => s.value === mod.status)?.color || ''
                                                    }`}>
                                                    {mod.status}
                                                </span>
                                                {mod.is_free_preview && (
                                                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700">
                                                        Free Preview
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-slate-500 line-clamp-1">
                                                {mod.description || 'No description'}
                                            </p>
                                            <div className="flex items-center gap-4 mt-1 text-xs text-slate-400">
                                                <span>{mod.lesson_count} lessons</span>
                                                {mod.estimated_minutes && <span>{mod.estimated_minutes} min</span>}
                                                <span className="font-mono text-slate-300">/{mod.slug}</span>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => navigateToModule(mod)}
                                                className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded text-sm font-medium hover:bg-blue-100"
                                            >
                                                Lessons →
                                            </button>
                                            <button
                                                onClick={() => openEditModule(mod)}
                                                className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded text-sm font-medium hover:bg-slate-200"
                                            >
                                                Edit
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ================================================================ */}
            {/* LESSONS VIEW                                                     */}
            {/* ================================================================ */}
            {view === 'lessons' && selectedModule && (
                <div>
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <button onClick={navigateBack} className="text-sm text-slate-500 hover:text-slate-700 mb-1">
                                ← Back to Modules
                            </button>
                            <h2 className="text-xl font-bold text-slate-800">
                                {selectedModule.title} — Lessons ({lessons.length})
                            </h2>
                        </div>
                        <button
                            onClick={openCreateLesson}
                            className="px-4 py-2 bg-[#2563eb] text-white rounded-lg font-medium hover:bg-[#1d4ed8]"
                        >
                            + Add Lesson
                        </button>
                    </div>

                    <div className="bg-white rounded-xl shadow overflow-hidden">
                        {loading ? (
                            <div className="p-12 text-center text-slate-500">Loading lessons...</div>
                        ) : lessons.length === 0 ? (
                            <div className="p-12 text-center text-slate-500">
                                <p className="text-lg mb-2">No lessons yet</p>
                                <p className="text-sm">Add lessons to build out this module.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {lessons.map((lesson, index) => {
                                    const lt = LESSON_TYPES.find(t => t.value === lesson.lesson_type)
                                    return (
                                        <div key={lesson.lesson_id} className="p-4 hover:bg-slate-50 flex items-center gap-4">
                                            {/* Reorder */}
                                            <div className="flex flex-col gap-1">
                                                <button
                                                    onClick={() => moveLesson(lesson.lesson_id, 'up')}
                                                    disabled={index === 0}
                                                    className="text-xs text-slate-400 hover:text-slate-600 disabled:opacity-30"
                                                >▲</button>
                                                <button
                                                    onClick={() => moveLesson(lesson.lesson_id, 'down')}
                                                    disabled={index === lessons.length - 1}
                                                    className="text-xs text-slate-400 hover:text-slate-600 disabled:opacity-30"
                                                >▼</button>
                                            </div>

                                            {/* Type icon */}
                                            <span className="text-xl">{lt?.icon || '📄'}</span>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="font-semibold text-slate-800">{lesson.title}</h3>
                                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUSES.find(s => s.value === lesson.status)?.color || ''
                                                        }`}>
                                                        {lesson.status}
                                                    </span>
                                                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                                                        {lt?.label || lesson.lesson_type}
                                                    </span>
                                                    {!lesson.is_required && (
                                                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-50 text-slate-400">
                                                            Optional
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-4 text-xs text-slate-400">
                                                    {lesson.estimated_minutes && <span>{lesson.estimated_minutes} min</span>}
                                                    <span className="font-mono text-slate-300">/{lesson.slug}</span>
                                                    {lesson.video_id && <span className="text-blue-400">🎬 Video linked</span>}
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <button
                                                onClick={() => openEditLesson(lesson)}
                                                className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded text-sm font-medium hover:bg-slate-200"
                                            >
                                                Edit
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ================================================================ */}
            {/* MODAL                                                            */}
            {/* ================================================================ */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-auto">
                        <div className="p-6 border-b border-slate-200">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-bold text-slate-800">
                                    {modalMode === 'create' ? 'Create' : 'Edit'}{' '}
                                    {view === 'courses' ? 'Course' : view === 'modules' ? 'Module' : 'Lesson'}
                                </h3>
                                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                            </div>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* ── COURSE FORM ── */}
                            {view === 'courses' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
                                        <input type="text" value={courseForm.title}
                                            onChange={e => setCourseForm({ ...courseForm, title: e.target.value, slug: slugify(e.target.value) })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="Foundations of Principled Negotiation" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Slug</label>
                                        <input type="text" value={courseForm.slug}
                                            onChange={e => setCourseForm({ ...courseForm, slug: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Icon (emoji)</label>
                                        <input type="text" value={courseForm.icon}
                                            onChange={e => setCourseForm({ ...courseForm, icon: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="🏛️" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Short Description</label>
                                        <input type="text" value={courseForm.short_description}
                                            onChange={e => setCourseForm({ ...courseForm, short_description: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="One-liner for the course card" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Full Description</label>
                                        <textarea value={courseForm.description}
                                            onChange={e => setCourseForm({ ...courseForm, description: e.target.value })}
                                            rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Access Tier</label>
                                            <select value={courseForm.access_tier}
                                                onChange={e => setCourseForm({ ...courseForm, access_tier: e.target.value })}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                                                {ACCESS_TIERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Estimated Hours</label>
                                            <input type="number" step="0.5" value={courseForm.estimated_hours}
                                                onChange={e => setCourseForm({ ...courseForm, estimated_hours: e.target.value })}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="4.0" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Certification Name</label>
                                            <input type="text" value={courseForm.certification_name}
                                                onChange={e => setCourseForm({ ...courseForm, certification_name: e.target.value })}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="Clarence Foundations Certificate" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Certification Level</label>
                                            <select value={courseForm.certification_level}
                                                onChange={e => setCourseForm({ ...courseForm, certification_level: e.target.value })}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                                                {CERT_LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                                        <select value={courseForm.status}
                                            onChange={e => setCourseForm({ ...courseForm, status: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                                            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                        </select>
                                    </div>
                                </>
                            )}

                            {/* ── MODULE FORM ── */}
                            {view === 'modules' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
                                        <input type="text" value={moduleForm.title}
                                            onChange={e => setModuleForm({ ...moduleForm, title: e.target.value, slug: slugify(e.target.value) })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="What Is Principled Negotiation?" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Slug</label>
                                        <input type="text" value={moduleForm.slug}
                                            onChange={e => setModuleForm({ ...moduleForm, slug: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                                        <textarea value={moduleForm.description}
                                            onChange={e => setModuleForm({ ...moduleForm, description: e.target.value })}
                                            rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Learning Objectives (comma-separated)</label>
                                        <textarea value={moduleForm.learning_objectives}
                                            onChange={e => setModuleForm({ ...moduleForm, learning_objectives: e.target.value })}
                                            rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                            placeholder="Understand principled negotiation, Identify adversarial patterns, Apply the three-position model" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Estimated Minutes</label>
                                            <input type="number" value={moduleForm.estimated_minutes}
                                                onChange={e => setModuleForm({ ...moduleForm, estimated_minutes: e.target.value })}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="30" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                                            <select value={moduleForm.status}
                                                onChange={e => setModuleForm({ ...moduleForm, status: e.target.value })}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                                                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input type="checkbox" id="free-preview" checked={moduleForm.is_free_preview}
                                            onChange={e => setModuleForm({ ...moduleForm, is_free_preview: e.target.checked })}
                                            className="rounded" />
                                        <label htmlFor="free-preview" className="text-sm text-slate-700">Free preview (visible to all tiers)</label>
                                    </div>
                                </>
                            )}

                            {/* ── LESSON FORM ── */}
                            {view === 'lessons' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
                                        <input type="text" value={lessonForm.title}
                                            onChange={e => setLessonForm({ ...lessonForm, title: e.target.value, slug: slugify(e.target.value) })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="Theory: Why Adversarial Fails" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Slug</label>
                                        <input type="text" value={lessonForm.slug}
                                            onChange={e => setLessonForm({ ...lessonForm, slug: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Lesson Type</label>
                                            <select value={lessonForm.lesson_type}
                                                onChange={e => setLessonForm({ ...lessonForm, lesson_type: e.target.value })}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                                                {LESSON_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Estimated Minutes</label>
                                            <input type="number" value={lessonForm.estimated_minutes}
                                                onChange={e => setLessonForm({ ...lessonForm, estimated_minutes: e.target.value })}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="5" />
                                        </div>
                                    </div>

                                    {/* Type-specific fields */}
                                    {(lessonForm.lesson_type === 'context') && (
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Content (Markdown)</label>
                                            <textarea value={lessonForm.content_markdown}
                                                onChange={e => setLessonForm({ ...lessonForm, content_markdown: e.target.value })}
                                                rows={8} className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm"
                                                placeholder="Written context material..." />
                                        </div>
                                    )}
                                    {lessonForm.lesson_type === 'exercise' && (
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Exercise URL</label>
                                            <input type="text" value={lessonForm.exercise_url}
                                                onChange={e => setLessonForm({ ...lessonForm, exercise_url: e.target.value })}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                                placeholder="https://clarencelegal.ai/auth/training?..." />
                                        </div>
                                    )}
                                    {lessonForm.lesson_type === 'resource' && (
                                        <>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Resource URL</label>
                                                <input type="text" value={lessonForm.resource_url}
                                                    onChange={e => setLessonForm({ ...lessonForm, resource_url: e.target.value })}
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Filename</label>
                                                <input type="text" value={lessonForm.resource_filename}
                                                    onChange={e => setLessonForm({ ...lessonForm, resource_filename: e.target.value })}
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="workbook.pdf" />
                                            </div>
                                        </>
                                    )}

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                                            <select value={lessonForm.status}
                                                onChange={e => setLessonForm({ ...lessonForm, status: e.target.value })}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                                                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex items-center gap-2 pt-6">
                                            <input type="checkbox" id="is-required" checked={lessonForm.is_required}
                                                onChange={e => setLessonForm({ ...lessonForm, is_required: e.target.checked })}
                                                className="rounded" />
                                            <label htmlFor="is-required" className="text-sm text-slate-700">Required for completion</label>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Modal footer */}
                        <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
                            <button onClick={() => setShowModal(false)}
                                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg">
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    if (view === 'courses') saveCourse()
                                    else if (view === 'modules') saveModule()
                                    else saveLesson()
                                }}
                                disabled={saving}
                                className="px-4 py-2 bg-[#2563eb] text-white rounded-lg font-medium hover:bg-[#1d4ed8] disabled:opacity-50"
                            >
                                {saving ? 'Saving...' : modalMode === 'create' ? 'Create' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}