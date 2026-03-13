import { redirect } from 'next/navigation'
import { getCatalogData } from '@/lib/training/data'
import CourseCard from '@/components/training/CourseCard'

export const metadata = {
  title: 'Sales Enablement | Throughput',
  description: 'Sharpen your sales skills and product knowledge.',
}

export default async function SalesCatalogPage() {
  const data = await getCatalogData('sales')

  if (!data) {
    redirect('/login')
  }

  const { courses, enrollments, completedLessonCountByCourse } = data

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
    <div data-testid="sales-catalog">
      {/* Hero section */}
      <div className="mb-10">
        <h1 className="text-4xl font-bold bg-gradient-brand bg-clip-text text-transparent">
          Sales Enablement
        </h1>
        <p className="mt-2 text-lg text-foreground-muted">
          Sharpen your sales skills and product knowledge
        </p>
      </div>

      {/* Course grid */}
      {enrichedCourses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {enrichedCourses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              basePath="/sales"
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface py-20">
          <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center mb-6">
            <SalesIcon />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            No courses available yet
          </h2>
          <p className="text-sm text-foreground-muted">
            Check back soon for new sales enablement content.
          </p>
        </div>
      )}
    </div>
  )
}

function SalesIcon() {
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
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
    </svg>
  )
}
