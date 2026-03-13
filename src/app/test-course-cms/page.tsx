'use client'

import { useState } from 'react'
import { CourseForm } from '@/components/admin/CourseForm'
import { LessonList } from '@/components/admin/LessonList'
import { StatusBadge } from '@/components/admin/StatusBadge'
import type { Database } from '@/lib/supabase/database.types'

type Course = Database['public']['Tables']['courses']['Row']
type Lesson = Database['public']['Tables']['lessons']['Row']

/**
 * Test-only course CMS page outside the (app) route group.
 * Bypasses auth middleware for E2E testing of course management flows.
 * This page should not be deployed to production.
 */

const MOCK_COURSE: Course = {
  id: '00000000-0000-0000-0000-000000000099',
  title: 'Test Course Alpha',
  slug: 'test-course-alpha',
  description: 'A test course for E2E testing.',
  zone: 'training',
  status: 'draft',
  passing_score: 70,
  navigation_mode: 'sequential',
  cover_image_url: null,
  learning_objectives: null,
  created_by: null,
  created_at: '2026-03-01T00:00:00Z',
  updated_at: '2026-03-12T00:00:00Z',
}

const MOCK_LESSONS: Lesson[] = [
  {
    id: '00000000-0000-0000-0000-000000000101',
    course_id: '00000000-0000-0000-0000-000000000099',
    title: 'Lesson One',
    slug: 'lesson-one',
    content: null,
    status: 'published',
    order_index: 0,
    video_ids: [],
    duration_minutes: null,
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-12T00:00:00Z',
  },
  {
    id: '00000000-0000-0000-0000-000000000102',
    course_id: '00000000-0000-0000-0000-000000000099',
    title: 'Lesson Two',
    slug: 'lesson-two',
    content: null,
    status: 'draft',
    order_index: 1,
    video_ids: [],
    duration_minutes: null,
    created_at: '2026-03-02T00:00:00Z',
    updated_at: '2026-03-12T00:00:00Z',
  },
]

type View = 'courses-list' | 'new-course' | 'edit-course' | 'empty-state'

export default function TestCourseCmsPage() {
  const [view, setView] = useState<View>('courses-list')

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* View switcher for testing different states */}
        <div className="flex gap-2 border-b border-border pb-4">
          <button
            onClick={() => setView('courses-list')}
            className={`rounded-md px-3 py-1.5 text-sm ${
              view === 'courses-list'
                ? 'bg-accent text-background'
                : 'bg-muted text-foreground'
            }`}
            data-testid="view-courses-list"
          >
            Courses List
          </button>
          <button
            onClick={() => setView('new-course')}
            className={`rounded-md px-3 py-1.5 text-sm ${
              view === 'new-course'
                ? 'bg-accent text-background'
                : 'bg-muted text-foreground'
            }`}
            data-testid="view-new-course"
          >
            New Course
          </button>
          <button
            onClick={() => setView('edit-course')}
            className={`rounded-md px-3 py-1.5 text-sm ${
              view === 'edit-course'
                ? 'bg-accent text-background'
                : 'bg-muted text-foreground'
            }`}
            data-testid="view-edit-course"
          >
            Edit Course
          </button>
          <button
            onClick={() => setView('empty-state')}
            className={`rounded-md px-3 py-1.5 text-sm ${
              view === 'empty-state'
                ? 'bg-accent text-background'
                : 'bg-muted text-foreground'
            }`}
            data-testid="view-empty-state"
          >
            Empty State
          </button>
        </div>

        {/* Courses List View */}
        {view === 'courses-list' && (
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-foreground">Courses</h1>
                <p className="mt-1 text-sm text-foreground-muted">
                  Manage training and sales enablement courses.
                </p>
              </div>
              <button
                onClick={() => setView('new-course')}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:bg-accent-hover transition-colors shadow-accent-glow"
                data-testid="new-course-button"
              >
                New Course
              </button>
            </div>

            <div className="mt-8">
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
                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-foreground-muted">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr
                      className="transition-colors hover:bg-raised"
                      data-testid="course-row-test-course-alpha"
                    >
                      <td className="px-5 py-4">
                        <div>
                          <button
                            onClick={() => setView('edit-course')}
                            className="text-sm font-medium text-foreground hover:text-accent transition-colors"
                          >
                            {MOCK_COURSE.title}
                          </button>
                          <p className="mt-0.5 text-xs text-foreground-muted line-clamp-1 max-w-md">
                            {MOCK_COURSE.description}
                          </p>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize bg-accent-muted text-accent"
                          data-testid="zone-badge-training"
                        >
                          {MOCK_COURSE.zone}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={MOCK_COURSE.status} />
                      </td>
                      <td className="px-5 py-4 text-center text-sm text-foreground-muted">
                        {MOCK_LESSONS.length}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setView('edit-course')}
                            className="rounded-md px-2.5 py-1.5 text-sm font-medium text-accent hover:bg-accent-muted transition-colors"
                            data-testid={`edit-course-${MOCK_COURSE.id}`}
                          >
                            Edit
                          </button>
                          <button
                            className="rounded-md px-2.5 py-1.5 text-sm font-medium text-[var(--destructive)] hover:bg-[var(--destructive-muted)] transition-colors"
                            data-testid={`delete-course-${MOCK_COURSE.id}`}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* New Course View */}
        {view === 'new-course' && (
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-6">New Course</h1>
            <div className="max-w-2xl">
              <CourseForm />
            </div>
          </div>
        )}

        {/* Edit Course View */}
        {view === 'edit-course' && (
          <div>
            <button
              onClick={() => setView('courses-list')}
              className="mb-6 inline-flex items-center gap-1.5 text-sm text-foreground-muted transition-colors hover:text-foreground"
              data-testid="back-to-courses"
            >
              &larr; Back to Courses
            </button>

            <div className="max-w-2xl">
              <CourseForm course={MOCK_COURSE} />
            </div>

            <div className="mt-10">
              <LessonList
                courseId={MOCK_COURSE.id}
                initialLessons={MOCK_LESSONS}
              />
            </div>
          </div>
        )}

        {/* Empty State View */}
        {view === 'empty-state' && (
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-foreground">Courses</h1>
                <p className="mt-1 text-sm text-foreground-muted">
                  Manage training and sales enablement courses.
                </p>
              </div>
              <button
                onClick={() => setView('new-course')}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:bg-accent-hover transition-colors shadow-accent-glow"
                data-testid="new-course-button"
              >
                New Course
              </button>
            </div>

            <div className="mt-8">
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
                  <button
                    onClick={() => setView('new-course')}
                    className="inline-flex items-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:bg-accent-hover transition-colors shadow-accent-glow"
                    data-testid="empty-new-course-button"
                  >
                    Create Course
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
