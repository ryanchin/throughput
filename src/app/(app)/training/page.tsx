import { getCatalogData } from '@/lib/training/data'
import CourseCard from '@/components/training/CourseCard'

export const metadata = {
  title: 'Training | Throughput',
  description: 'Build your skills with guided training courses.',
}

export default async function TrainingCatalogPage() {
  // Auth is enforced by proxy.ts — getCatalogData may return null if
  // cookies haven't propagated yet; treat as empty rather than redirecting.
  const data = await getCatalogData('training')
  console.log(`[training] data: ${data ? 'found' : 'null'}`)

  const courses = data?.courses ?? []
  const enrollments = data?.enrollments ?? new Map()
  const completedLessonCountByCourse = data?.completedLessonCountByCourse ?? new Map()

  // Build enriched course objects for CourseCard
  const enrichedCourses = courses.map((course) => {
    const enrollment = enrollments.get(course.id)
    return {
      ...course,
      completed_lesson_count: completedLessonCountByCourse.get(course.id) ?? 0,
      enrollment: enrollment
        ? { id: course.id, enrolled_at: enrollment.enrolled_at, completed_at: enrollment.completed_at }
        : null,
    }
  })

  return (
    <div data-testid="training-catalog">
      {/* Hero section */}
      <div className="mb-10">
        <h1 className="text-4xl font-bold bg-gradient-brand bg-clip-text text-transparent">
          Training
        </h1>
        <p className="mt-2 text-lg text-foreground-muted">
          Build your skills with guided courses
        </p>
      </div>

      {/* Course grid */}
      {enrichedCourses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {enrichedCourses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              basePath="/training"
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface py-20">
          <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center mb-6">
            <BookStackIcon />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            No courses available yet
          </h2>
          <p className="text-sm text-foreground-muted">
            Check back soon for new training content.
          </p>
        </div>
      )}
    </div>
  )
}

function BookStackIcon() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--foreground-muted)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
      <path d="M8 7h6" />
      <path d="M8 11h8" />
    </svg>
  )
}
