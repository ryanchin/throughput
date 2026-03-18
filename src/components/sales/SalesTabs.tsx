'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import CourseCard from '@/components/training/CourseCard'
import { MaterialsLibrary } from './MaterialsLibrary'

interface SalesTabsProps {
  courses: Array<{
    id: string
    title: string
    slug: string
    description: string | null
    zone: 'training' | 'sales'
    cover_image_url: string | null
    lesson_count: number
    total_duration_minutes: number
    completed_lesson_count: number
    enrollment: { id: string; enrolled_at: string; completed_at: string | null } | null
  }>
  materials: Array<{
    id: string
    title: string
    slug: string
    description: string | null
    material_type: string
    category: string | null
    tags: string[]
    file_name: string | null
    file_mime_type: string | null
    shareable: boolean
    share_token: string | null
    updated_at: string
  }>
  categories: { id: string; name: string; slug: string }[]
}

export function SalesTabs({ courses, materials, categories }: SalesTabsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeTab = searchParams.get('tab') === 'materials' ? 'materials' : 'courses'

  function handleTabChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', value)
    // Clear material filters when switching to courses tab
    if (value === 'courses') {
      params.delete('type')
      params.delete('category')
      params.delete('q')
    }
    router.replace(`/sales?${params.toString()}`)
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} data-testid="sales-tabs">
      <TabsList className="bg-muted border border-border">
        <TabsTrigger value="courses" data-testid="courses-tab">
          Courses
          {courses.length > 0 && (
            <span className="ml-1.5 text-xs text-foreground-muted">({courses.length})</span>
          )}
        </TabsTrigger>
        <TabsTrigger value="materials" data-testid="materials-tab">
          Materials
          {materials.length > 0 && (
            <span className="ml-1.5 text-xs text-foreground-muted">({materials.length})</span>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="courses" className="mt-6">
        {courses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <CourseCard key={course.id} course={course} basePath="/sales" />
            ))}
          </div>
        ) : (
          <EmptyState type="courses" />
        )}
      </TabsContent>

      <TabsContent value="materials" className="mt-6">
        <MaterialsLibrary materials={materials} categories={categories} />
      </TabsContent>
    </Tabs>
  )
}

function EmptyState({ type }: { type: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface py-20">
      <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center mb-6">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--foreground-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="12" y1="20" x2="12" y2="10" />
          <line x1="18" y1="20" x2="18" y2="4" />
          <line x1="6" y1="20" x2="6" y2="16" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-foreground mb-2">
        No {type} available yet
      </h2>
      <p className="text-sm text-foreground-muted">
        Check back soon for new sales enablement content.
      </p>
    </div>
  )
}
