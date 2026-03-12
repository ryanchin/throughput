import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { CourseForm } from '@/components/admin/CourseForm'
import { LessonList } from '@/components/admin/LessonList'

export const metadata = {
  title: 'Edit Course | Admin',
}

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>
}) {
  const { courseId } = await params
  const supabase = await createClient()

  // Fetch course
  const { data: course, error } = await supabase
    .from('courses')
    .select('*')
    .eq('id', courseId)
    .maybeSingle()

  if (error || !course) {
    notFound()
  }

  // Fetch lessons for this course, ordered by order_index
  const { data: lessons } = await supabase
    .from('lessons')
    .select('*')
    .eq('course_id', courseId)
    .order('order_index', { ascending: true })

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      {/* Back link */}
      <Link
        href="/admin/courses"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-foreground-muted transition-colors hover:text-foreground"
        data-testid="back-to-courses"
      >
        &larr; Back to Courses
      </Link>

      {/* Course form */}
      <div className="max-w-2xl">
        <CourseForm course={course} />
      </div>

      {/* Lessons section */}
      <div className="mt-10">
        <LessonList courseId={courseId} initialLessons={lessons ?? []} />
      </div>
    </div>
  )
}
