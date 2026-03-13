'use client'

import CourseCard from '@/components/training/CourseCard'
import ProgressRing from '@/components/training/ProgressRing'

// Mock courses with different states
const MOCK_COURSES = [
  {
    id: '1',
    title: 'Getting Started with AAVA',
    slug: 'getting-started',
    description: 'Learn the fundamentals of the AAVA methodology.',
    zone: 'training' as const,
    cover_image_url: null,
    lesson_count: 5,
    total_duration_minutes: 120,
    completed_lesson_count: 0,
    enrollment: null, // Not enrolled
  },
  {
    id: '2',
    title: 'Sprint Planning Mastery',
    slug: 'sprint-planning',
    description: 'Master the art of sprint planning with real-world scenarios.',
    zone: 'training' as const,
    cover_image_url: null,
    lesson_count: 8,
    total_duration_minutes: 240,
    completed_lesson_count: 3,
    enrollment: {
      id: '2',
      enrolled_at: '2026-03-01T00:00:00Z',
      completed_at: null,
    }, // In progress
  },
  {
    id: '3',
    title: 'Sales Fundamentals',
    slug: 'sales-fundamentals',
    description: 'Essential sales techniques for the modern seller.',
    zone: 'sales' as const,
    cover_image_url: null,
    lesson_count: 6,
    total_duration_minutes: 90,
    completed_lesson_count: 6,
    enrollment: {
      id: '3',
      enrolled_at: '2026-02-01T00:00:00Z',
      completed_at: '2026-03-01T00:00:00Z',
    }, // Completed
  },
]

export default function TestTrainingCatalog() {
  return (
    <div
      className="min-h-screen bg-background p-8"
      data-testid="test-training-catalog"
    >
      <h1 className="text-2xl font-bold text-foreground mb-6">
        Test Training Catalog
      </h1>

      {/* Progress Ring test */}
      <div className="mb-8 flex gap-6" data-testid="progress-rings">
        <ProgressRing completed={0} total={5} />
        <ProgressRing completed={3} total={8} />
        <ProgressRing completed={5} total={5} />
      </div>

      {/* Course grid */}
      <div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        data-testid="course-grid"
      >
        {MOCK_COURSES.map((course) => (
          <CourseCard key={course.id} course={course} basePath="/training" />
        ))}
      </div>
    </div>
  )
}
