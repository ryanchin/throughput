import { redirect, notFound } from 'next/navigation'
import { getCourseData } from '@/lib/training/data'
import { calculateProgress, getNextLessonSlug } from '@/lib/training/progress'
import ProgressRing from '@/components/training/ProgressRing'
import LessonNav from '@/components/training/LessonNav'
import EnrollButton from '@/components/training/EnrollButton'

export default async function SalesCourseOverviewPage({
  params,
}: {
  params: Promise<{ courseSlug: string }>
}) {
  const { courseSlug } = await params
  const data = await getCourseData(courseSlug, 'sales')

  if (!data) {
    const { getProfile } = await import('@/lib/auth/getProfile')
    const profile = await getProfile()
    if (!profile) redirect('/login')
    notFound()
  }

  const { course, lessons, enrollment, completedLessonIds } = data
  const completedSet = new Set(completedLessonIds)
  const completedCount = completedLessonIds.length
  const totalLessons = lessons.length
  const progress = calculateProgress(completedCount, totalLessons)
  const totalDuration = lessons.reduce((sum, l) => sum + (l.duration_minutes ?? 0), 0)

  const nextLessonSlug = getNextLessonSlug(lessons, completedLessonIds)
  const firstLessonSlug = lessons.length > 0 ? lessons[0].slug : null

  // Build props for LessonNav
  const lessonProgress = lessons.map((l) => ({
    lesson_id: l.id,
    completed_at: completedSet.has(l.id) ? 'completed' : null,
  }))

  const quizInfo = lessons
    .filter((l) => l.hasQuiz)
    .map((l) => ({
      lessonId: l.id,
      passed: false,
    }))

  return (
    <div data-testid="course-overview">
      {/* Hero section */}
      <div className="relative rounded-xl overflow-hidden mb-8">
        {course.cover_image_url ? (
          <img
            src={course.cover_image_url}
            alt={`${course.title} cover`}
            className="w-full h-56 object-cover"
          />
        ) : (
          <div className="w-full h-56 bg-gradient-brand opacity-20" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="rounded-full bg-secondary-muted px-3 py-1 text-xs font-medium text-secondary uppercase tracking-wide">
              Sales
            </span>
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground-muted capitalize">
              {course.navigation_mode} navigation
            </span>
          </div>
          <h1 className="text-3xl font-bold text-foreground">{course.title}</h1>
          {course.description && (
            <p className="mt-2 text-foreground-muted max-w-2xl">{course.description}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Learning objectives */}
          {course.learning_objectives && course.learning_objectives.length > 0 && (
            <div className="bg-surface border border-border rounded-xl shadow-card p-6">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                What you will learn
              </h2>
              <ul className="space-y-2">
                {course.learning_objectives.map((objective, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-foreground-muted">
                    <CheckIcon className="mt-0.5 flex-shrink-0" />
                    <span>{objective}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Lesson list */}
          <div className="bg-surface border border-border rounded-xl shadow-card p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Course Content
            </h2>
            <LessonNav
              lessons={lessons}
              lessonProgress={lessonProgress}
              quizInfo={quizInfo}
              currentLessonSlug=""
              courseSlug={courseSlug}
              basePath="/sales"
              navigationMode={course.navigation_mode}
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-surface border border-border rounded-xl shadow-card p-6 space-y-6">
            {/* Progress ring (if enrolled) */}
            {enrollment && (
              <div className="flex items-center gap-4">
                <ProgressRing completed={completedCount} total={totalLessons} size={72} strokeWidth={5} />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {completedCount} of {totalLessons} completed
                  </p>
                  <p className="text-xs text-foreground-muted">
                    {progress === 100 ? 'Course complete' : 'Keep going'}
                  </p>
                </div>
              </div>
            )}

            <EnrollButton
              courseId={course.id}
              courseSlug={courseSlug}
              firstLessonSlug={firstLessonSlug}
              basePath="/sales"
              isEnrolled={!!enrollment}
              nextLessonSlug={nextLessonSlug}
            />

            {/* Stats */}
            <div className="space-y-3 pt-2 border-t border-border">
              <StatRow label="Lessons" value={`${totalLessons}`} />
              <StatRow
                label="Duration"
                value={formatDuration(totalDuration)}
              />
              <StatRow label="Navigation" value={course.navigation_mode === 'sequential' ? 'Sequential' : 'Free'} />
              <StatRow
                label="Passing score"
                value={`${course.passing_score}%`}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-foreground-muted">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  )
}

function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0m'
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--accent)"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}
