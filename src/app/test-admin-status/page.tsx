'use client'

import { useState } from 'react'
import { CourseCard } from '@/components/admin/CourseCard'
import { LessonRow } from '@/components/admin/LessonRow'
import type { ContentStatus } from '@/lib/admin/content-validation'

// Mock data for testing
const MOCK_COURSES = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    title: 'Introduction to AAVA',
    description: 'Learn the fundamentals of the AAVA methodology.',
    zone: 'training',
    status: 'draft' as ContentStatus,
    slug: 'intro-to-aava',
    updatedAt: '2026-03-12T00:00:00Z',
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    title: 'Sales Playbook',
    description: 'Master the AAVA sales methodology and tools.',
    zone: 'sales',
    status: 'published' as ContentStatus,
    slug: 'sales-playbook',
    updatedAt: '2026-03-11T00:00:00Z',
  },
]

const MOCK_LESSONS = [
  { id: '00000000-0000-0000-0000-000000000010', title: 'What is AAVA?', status: 'published' as ContentStatus, orderIndex: 0 },
  { id: '00000000-0000-0000-0000-000000000011', title: 'Core Principles', status: 'draft' as ContentStatus, orderIndex: 1 },
  { id: '00000000-0000-0000-0000-000000000012', title: 'Getting Started', status: 'draft' as ContentStatus, orderIndex: 2 },
]

export default function TestAdminStatusPage() {
  const [lessons, setLessons] = useState(MOCK_LESSONS)

  function handleLessonStatusChange(lessonId: string, newStatus: ContentStatus) {
    setLessons(prev =>
      prev.map(l => l.id === lessonId ? { ...l, status: newStatus } : l)
    )
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <h1 className="text-3xl font-bold text-foreground">Admin: Course Management</h1>

        {/* Course cards */}
        <section>
          <h2 className="mb-4 text-xl font-semibold text-foreground">Courses</h2>
          <div className="space-y-4">
            {MOCK_COURSES.map(course => (
              <CourseCard key={course.id} {...course} />
            ))}
          </div>
        </section>

        {/* Lesson rows (for first course) */}
        <section>
          <h2 className="mb-4 text-xl font-semibold text-foreground">
            Lessons: Introduction to AAVA
          </h2>
          <div className="space-y-2">
            {lessons.map(lesson => (
              <LessonRow
                key={lesson.id}
                {...lesson}
                onStatusChange={(newStatus) => handleLessonStatusChange(lesson.id, newStatus)}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
