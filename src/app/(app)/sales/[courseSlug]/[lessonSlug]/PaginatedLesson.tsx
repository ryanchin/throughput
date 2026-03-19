'use client'

import { SectionPaginator } from '@/components/training/SectionPaginator'
import type { ContentPage } from '@/lib/training/content-splitter'

interface PaginatedLessonProps {
  pages: ContentPage[]
  quizUrl?: string
  hasQuiz: boolean
  hasPassedQuiz: boolean
  completeButton: React.ReactNode
}

export function PaginatedLesson(props: PaginatedLessonProps) {
  return <SectionPaginator {...props} />
}
