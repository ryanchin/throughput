import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/auth/getProfile'
import type { Zone, UserRole } from '@/lib/supabase/database.types'

// ---------- Types ----------

export interface CatalogCourse {
  id: string
  title: string
  description: string | null
  slug: string
  zone: Zone
  cover_image_url: string | null
  lesson_count: number
  total_duration_minutes: number
}

export interface CatalogEnrollment {
  enrolled_at: string
  completed_at: string | null
}

export interface CatalogData {
  courses: CatalogCourse[]
  enrollments: Map<string, CatalogEnrollment>
  completedLessonCountByCourse: Map<string, number>
  profile: { id: string; role: UserRole; full_name: string | null; email: string }
}

export interface CourseOverviewLesson {
  id: string
  title: string
  slug: string
  order_index: number
  duration_minutes: number | null
  hasQuiz: boolean
}

export interface CourseData {
  course: {
    id: string
    title: string
    description: string | null
    slug: string
    zone: Zone
    cover_image_url: string | null
    learning_objectives: string[] | null
    passing_score: number
    navigation_mode: 'sequential' | 'free'
  }
  lessons: CourseOverviewLesson[]
  enrollment: CatalogEnrollment | null
  completedLessonIds: string[]
  profile: { id: string; role: UserRole }
}

export interface LessonData {
  course: {
    id: string
    title: string
    slug: string
    zone: Zone
    navigation_mode: 'sequential' | 'free'
  }
  lesson: {
    id: string
    title: string
    slug: string
    content: unknown
    order_index: number
    duration_minutes: number | null
  }
  lessons: Array<{
    id: string
    title: string
    slug: string
    order_index: number
    hasQuiz: boolean
  }>
  enrollment: CatalogEnrollment | null
  completedLessonIds: string[]
  isCurrentLessonCompleted: boolean
  hasQuiz: boolean
  hasPassedQuiz: boolean
  profile: { id: string; role: UserRole }
}

// ---------- Helpers ----------

function canAccessZone(role: UserRole, zone: Zone): boolean {
  if (role === 'admin') return true
  if (zone === 'training') return ['employee', 'sales'].includes(role)
  if (zone === 'sales') return role === 'sales'
  return false
}

// ---------- Data Fetchers ----------

/**
 * Fetch catalog data for a zone. Returns null if user is not authenticated
 * or does not have access to the requested zone.
 */
export async function getCatalogData(zone: Zone): Promise<CatalogData | null> {
  const profile = await getProfile()
  if (!profile) return null
  if (!canAccessZone(profile.role, zone)) return null

  const supabase = await createClient()

  // Fetch published courses in this zone
  const { data: courses, error: coursesError } = await supabase
    .from('courses')
    .select('id, title, slug, description, zone, cover_image_url')
    .eq('status', 'published')
    .eq('zone', zone)
    .order('created_at', { ascending: false })

  if (coursesError || !courses) return null

  if (courses.length === 0) {
    return {
      courses: [],
      enrollments: new Map(),
      completedLessonCountByCourse: new Map(),
      profile: { id: profile.id, role: profile.role, full_name: profile.full_name, email: profile.email },
    }
  }

  const courseIds = courses.map((c) => c.id)

  // Parallel batch queries
  const [lessonsResult, enrollmentsResult, progressResult] = await Promise.all([
    supabase
      .from('lessons')
      .select('id, course_id, duration_minutes')
      .in('course_id', courseIds)
      .eq('status', 'published'),
    supabase
      .from('course_enrollments')
      .select('course_id, enrolled_at, completed_at')
      .eq('user_id', profile.id)
      .in('course_id', courseIds),
    supabase
      .from('lesson_progress')
      .select('lesson_id, completed_at')
      .eq('user_id', profile.id)
      .not('completed_at', 'is', null),
  ])

  const lessons = lessonsResult.data ?? []
  const enrollments = enrollmentsResult.data ?? []
  const completedProgress = progressResult.data ?? []

  // Build lesson count and duration per course
  const lessonsByCourse = new Map<string, typeof lessons>()
  for (const lesson of lessons) {
    const existing = lessonsByCourse.get(lesson.course_id) ?? []
    existing.push(lesson)
    lessonsByCourse.set(lesson.course_id, existing)
  }

  // Build enrollment map
  const enrollmentMap = new Map<string, CatalogEnrollment>()
  for (const e of enrollments) {
    enrollmentMap.set(e.course_id, {
      enrolled_at: e.enrolled_at,
      completed_at: e.completed_at,
    })
  }

  // Build completed lesson set
  const completedLessonIds = new Set(completedProgress.map((p) => p.lesson_id))

  // Calculate completed count per course
  const completedCountByCourse = new Map<string, number>()
  for (const [courseId, courseLessons] of lessonsByCourse) {
    const count = courseLessons.filter((l) => completedLessonIds.has(l.id)).length
    completedCountByCourse.set(courseId, count)
  }

  // Build enriched courses
  const enrichedCourses: CatalogCourse[] = courses.map((course) => {
    const courseLessons = lessonsByCourse.get(course.id) ?? []
    return {
      ...course,
      lesson_count: courseLessons.length,
      total_duration_minutes: courseLessons.reduce(
        (sum, l) => sum + (l.duration_minutes ?? 0),
        0
      ),
    }
  })

  return {
    courses: enrichedCourses,
    enrollments: enrollmentMap,
    completedLessonCountByCourse: completedCountByCourse,
    profile: { id: profile.id, role: profile.role, full_name: profile.full_name, email: profile.email },
  }
}

/**
 * Fetch course overview data. Returns null if the course doesn't exist,
 * is a draft, or the user lacks zone access.
 */
export async function getCourseData(
  courseSlug: string,
  zone: Zone
): Promise<CourseData | null> {
  const profile = await getProfile()
  if (!profile) return null
  if (!canAccessZone(profile.role, zone)) return null

  const supabase = await createClient()

  // Fetch course
  const { data: course, error: courseError } = await supabase
    .from('courses')
    .select(
      'id, title, description, slug, zone, cover_image_url, learning_objectives, passing_score, navigation_mode'
    )
    .eq('slug', courseSlug)
    .eq('zone', zone)
    .eq('status', 'published')
    .single()

  if (courseError || !course) return null

  // Parallel: lessons, enrollment, progress, quizzes
  const [lessonsResult, enrollmentResult, progressResult] = await Promise.all([
    supabase
      .from('lessons')
      .select('id, title, slug, order_index, duration_minutes')
      .eq('course_id', course.id)
      .eq('status', 'published')
      .order('order_index', { ascending: true }),
    supabase
      .from('course_enrollments')
      .select('enrolled_at, completed_at')
      .eq('user_id', profile.id)
      .eq('course_id', course.id)
      .maybeSingle(),
    supabase
      .from('lesson_progress')
      .select('lesson_id, completed_at')
      .eq('user_id', profile.id)
      .not('completed_at', 'is', null),
  ])

  const rawLessons = lessonsResult.data ?? []
  const enrollment = enrollmentResult.data
  const completedProgress = progressResult.data ?? []

  // Fetch quizzes for all lessons
  const lessonIds = rawLessons.map((l) => l.id)
  let quizLessonIds = new Set<string>()
  if (lessonIds.length > 0) {
    const { data: quizzes } = await supabase
      .from('quizzes')
      .select('lesson_id')
      .in('lesson_id', lessonIds)
    if (quizzes) {
      quizLessonIds = new Set(quizzes.map((q) => q.lesson_id))
    }
  }

  const lessons: CourseOverviewLesson[] = rawLessons.map((l) => ({
    ...l,
    hasQuiz: quizLessonIds.has(l.id),
  }))

  const completedLessonIds = completedProgress
    .filter((p) => lessonIds.includes(p.lesson_id))
    .map((p) => p.lesson_id)

  return {
    course,
    lessons,
    enrollment: enrollment
      ? { enrolled_at: enrollment.enrolled_at, completed_at: enrollment.completed_at }
      : null,
    completedLessonIds,
    profile: { id: profile.id, role: profile.role },
  }
}

/**
 * Fetch lesson page data. Returns null if the course/lesson doesn't exist,
 * is a draft, or the user lacks zone access.
 */
export async function getLessonData(
  courseSlug: string,
  lessonSlug: string,
  zone: Zone
): Promise<LessonData | null> {
  const profile = await getProfile()
  if (!profile) return null
  if (!canAccessZone(profile.role, zone)) return null

  const supabase = await createClient()

  // Fetch course
  const { data: course, error: courseError } = await supabase
    .from('courses')
    .select('id, title, slug, zone, navigation_mode')
    .eq('slug', courseSlug)
    .eq('zone', zone)
    .eq('status', 'published')
    .single()

  if (courseError || !course) return null

  // Fetch the current lesson
  const { data: lesson, error: lessonError } = await supabase
    .from('lessons')
    .select('id, title, slug, content, order_index, duration_minutes')
    .eq('course_id', course.id)
    .eq('slug', lessonSlug)
    .eq('status', 'published')
    .single()

  if (lessonError || !lesson) return null

  // Parallel: all lessons, enrollment, progress, quizzes
  const [allLessonsResult, enrollmentResult, progressResult] = await Promise.all([
    supabase
      .from('lessons')
      .select('id, title, slug, order_index')
      .eq('course_id', course.id)
      .eq('status', 'published')
      .order('order_index', { ascending: true }),
    supabase
      .from('course_enrollments')
      .select('enrolled_at, completed_at')
      .eq('user_id', profile.id)
      .eq('course_id', course.id)
      .maybeSingle(),
    supabase
      .from('lesson_progress')
      .select('lesson_id, completed_at')
      .eq('user_id', profile.id)
      .not('completed_at', 'is', null),
  ])

  const allLessons = allLessonsResult.data ?? []
  const enrollment = enrollmentResult.data
  const completedProgress = progressResult.data ?? []

  // Quiz data for all lessons and current lesson
  const lessonIds = allLessons.map((l) => l.id)
  let quizLessonIds = new Set<string>()
  if (lessonIds.length > 0) {
    const { data: quizzes } = await supabase
      .from('quizzes')
      .select('lesson_id')
      .in('lesson_id', lessonIds)
    if (quizzes) {
      quizLessonIds = new Set(quizzes.map((q) => q.lesson_id))
    }
  }

  // Check if user passed the quiz for the current lesson
  let hasPassedQuiz = false
  const hasQuiz = quizLessonIds.has(lesson.id)
  if (hasQuiz) {
    const { data: quizzes } = await supabase
      .from('quizzes')
      .select('id')
      .eq('lesson_id', lesson.id)

    if (quizzes && quizzes.length > 0) {
      const quizIds = quizzes.map((q) => q.id)
      const { data: passingAttempts } = await supabase
        .from('quiz_attempts')
        .select('id')
        .eq('user_id', profile.id)
        .in('quiz_id', quizIds)
        .eq('passed', true)
        .limit(1)

      hasPassedQuiz = (passingAttempts?.length ?? 0) > 0
    }
  }

  const completedLessonIds = completedProgress
    .filter((p) => lessonIds.includes(p.lesson_id))
    .map((p) => p.lesson_id)

  const isCurrentLessonCompleted = completedLessonIds.includes(lesson.id)

  const lessonsWithQuiz = allLessons.map((l) => ({
    ...l,
    hasQuiz: quizLessonIds.has(l.id),
  }))

  return {
    course,
    lesson,
    lessons: lessonsWithQuiz,
    enrollment: enrollment
      ? { enrolled_at: enrollment.enrolled_at, completed_at: enrollment.completed_at }
      : null,
    completedLessonIds,
    isCurrentLessonCompleted,
    hasQuiz,
    hasPassedQuiz,
    profile: { id: profile.id, role: profile.role },
  }
}
