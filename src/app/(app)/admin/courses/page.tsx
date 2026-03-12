import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { CourseActions } from './CourseActions'

export default async function AdminCoursesPage() {
  const supabase = await createClient()

  // Verify admin access
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    redirect('/training')
  }

  // Fetch all courses (draft + published) ordered by most recently updated
  const { data: courses, error: coursesError } = await supabase
    .from('courses')
    .select('id, title, slug, description, zone, status, created_at, updated_at')
    .order('updated_at', { ascending: false })

  if (coursesError) {
    return (
      <div className="text-center py-12">
        <p className="text-foreground-muted">Failed to load courses. Please try again.</p>
      </div>
    )
  }

  // Fetch lesson counts and enrollment counts
  const courseIds = (courses ?? []).map((c) => c.id)

  let lessonCountMap: Record<string, number> = {}
  let enrollmentCountMap: Record<string, number> = {}

  if (courseIds.length > 0) {
    const { data: lessonRows } = await supabase
      .from('lessons')
      .select('course_id')
      .in('course_id', courseIds)

    const { data: enrollmentRows } = await supabase
      .from('course_enrollments')
      .select('course_id')
      .in('course_id', courseIds)

    for (const row of lessonRows ?? []) {
      lessonCountMap[row.course_id] = (lessonCountMap[row.course_id] ?? 0) + 1
    }

    for (const row of enrollmentRows ?? []) {
      enrollmentCountMap[row.course_id] = (enrollmentCountMap[row.course_id] ?? 0) + 1
    }
  }

  const enrichedCourses = (courses ?? []).map((course) => ({
    ...course,
    lesson_count: lessonCountMap[course.id] ?? 0,
    enrollment_count: enrollmentCountMap[course.id] ?? 0,
  }))

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Courses</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            Manage training and sales enablement courses.
          </p>
        </div>
        <Link
          href="/admin/courses/new"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:bg-accent-hover transition-colors shadow-accent-glow"
          data-testid="new-course-button"
        >
          New Course
        </Link>
      </div>

      {/* Course list */}
      <div className="mt-8">
        {enrichedCourses.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
                <table className="w-full" data-testid="courses-table">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">
                        Title
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">
                        Zone
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">
                        Status
                      </th>
                      <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wider text-foreground-muted">
                        Lessons
                      </th>
                      <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wider text-foreground-muted">
                        Enrollments
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">
                        Last Updated
                      </th>
                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-foreground-muted">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {enrichedCourses.map((course) => (
                      <tr
                        key={course.id}
                        className="transition-colors hover:bg-raised"
                        data-testid={`course-row-${course.slug}`}
                      >
                        <td className="px-5 py-4">
                          <div>
                            <Link
                              href={`/admin/courses/${course.id}`}
                              className="text-sm font-medium text-foreground hover:text-accent transition-colors"
                            >
                              {course.title}
                            </Link>
                            {course.description && (
                              <p className="mt-0.5 text-xs text-foreground-muted line-clamp-1 max-w-md">
                                {course.description}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <ZoneBadge zone={course.zone} />
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge status={course.status} />
                        </td>
                        <td className="px-5 py-4 text-center text-sm text-foreground-muted">
                          {course.lesson_count}
                        </td>
                        <td className="px-5 py-4 text-center text-sm text-foreground-muted">
                          {course.enrollment_count}
                        </td>
                        <td className="px-5 py-4 text-sm text-foreground-muted">
                          {new Date(course.updated_at).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <CourseActions
                            courseId={course.id}
                            courseTitle={course.title}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile card list */}
            <div className="space-y-3 md:hidden">
              {enrichedCourses.map((course) => (
                <div
                  key={course.id}
                  className="rounded-xl border border-border bg-surface p-4 shadow-card"
                  data-testid={`course-card-${course.slug}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <Link
                        href={`/admin/courses/${course.id}`}
                        className="text-sm font-medium text-foreground hover:text-accent transition-colors"
                      >
                        {course.title}
                      </Link>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <ZoneBadge zone={course.zone} />
                        <StatusBadge status={course.status} />
                      </div>
                    </div>
                  </div>
                  {course.description && (
                    <p className="mt-2 text-xs text-foreground-muted line-clamp-2">
                      {course.description}
                    </p>
                  )}
                  <div className="mt-3 flex items-center gap-4 text-xs text-foreground-muted">
                    <span>{course.lesson_count} lessons</span>
                    <span>{course.enrollment_count} enrolled</span>
                    <span>Updated {new Date(course.updated_at).toLocaleDateString()}</span>
                  </div>
                  <div className="mt-3 border-t border-border pt-3">
                    <CourseActions
                      courseId={course.id}
                      courseTitle={course.title}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ZoneBadge({ zone }: { zone: string }) {
  const styles: Record<string, string> = {
    training: 'bg-accent-muted text-accent',
    sales: 'bg-[var(--secondary-muted)] text-[var(--secondary)]',
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
        styles[zone] ?? 'bg-[var(--background-muted)] text-foreground-muted'
      }`}
      data-testid={`zone-badge-${zone}`}
    >
      {zone}
    </span>
  )
}

function EmptyState() {
  return (
    <div
      className="rounded-xl border border-border bg-surface p-12 text-center shadow-card"
      data-testid="courses-empty-state"
    >
      <svg
        className="mx-auto size-12 text-foreground-muted"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
        />
      </svg>
      <h3 className="mt-4 text-lg font-semibold text-foreground">No courses yet</h3>
      <p className="mt-1 text-sm text-foreground-muted">
        Get started by creating your first training course.
      </p>
      <div className="mt-6">
        <Link
          href="/admin/courses/new"
          className="inline-flex items-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:bg-accent-hover transition-colors shadow-accent-glow"
          data-testid="empty-new-course-button"
        >
          Create Course
        </Link>
      </div>
    </div>
  )
}
