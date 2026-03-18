import { redirect } from 'next/navigation'
import { getCatalogData } from '@/lib/training/data'
import { getMaterialsList, getMaterialCategories } from '@/lib/sales/materials'
import { SalesTabs } from '@/components/sales/SalesTabs'

export const metadata = {
  title: 'Sales Enablement | Throughput',
  description: 'Sharpen your sales skills and access prospect-facing materials.',
}

export default async function SalesCatalogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const typeFilter = typeof params.type === 'string' ? params.type : undefined
  const categoryFilter = typeof params.category === 'string' ? params.category : undefined
  const searchFilter = typeof params.q === 'string' ? params.q : undefined

  // Parallel data fetching for courses and materials
  const [catalogData, materials, categories] = await Promise.all([
    getCatalogData('sales'),
    getMaterialsList({ type: typeFilter, category: categoryFilter, q: searchFilter }),
    getMaterialCategories(),
  ])

  if (!catalogData) {
    redirect('/login')
  }

  const { courses, enrollments, completedLessonCountByCourse } = catalogData

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
          Courses, battle cards, and collateral to close deals faster
        </p>
      </div>

      {/* Tabbed content */}
      <SalesTabs
        courses={enrichedCourses}
        materials={materials ?? []}
        categories={categories ?? []}
      />
    </div>
  )
}
