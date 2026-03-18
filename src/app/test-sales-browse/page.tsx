'use client'

import { Suspense } from 'react'
import { SalesTabs } from '@/components/sales/SalesTabs'

/**
 * Test page for sales materials browse E2E tests.
 * Renders the SalesTabs component with mock data, bypassing auth and DB calls.
 */

const mockCourses = [
  {
    id: 'course-1',
    title: 'Sales Fundamentals',
    slug: 'sales-fundamentals',
    description: 'Learn the basics of selling our product.',
    zone: 'sales' as const,
    cover_image_url: null,
    lesson_count: 5,
    total_duration_minutes: 120,
    completed_lesson_count: 5,
    enrollment: { id: 'course-1', enrolled_at: '2026-01-01T00:00:00Z', completed_at: '2026-02-15T00:00:00Z' },
  },
  {
    id: 'course-2',
    title: 'Enterprise Closing',
    slug: 'enterprise-closing',
    description: 'Advanced techniques for closing enterprise deals.',
    zone: 'sales' as const,
    cover_image_url: null,
    lesson_count: 8,
    total_duration_minutes: 240,
    completed_lesson_count: 3,
    enrollment: { id: 'course-2', enrolled_at: '2026-03-01T00:00:00Z', completed_at: null },
  },
]

const mockMaterials = [
  {
    id: 'mat-1',
    title: 'Enterprise Battle Card',
    slug: 'enterprise-battle-card',
    description: 'Competitive positioning against Acme Corp for enterprise deals.',
    material_type: 'battle_card',
    category: 'Enterprise',
    tags: ['enterprise', 'competitive'],
    file_name: 'enterprise-battle-card.pdf',
    file_mime_type: 'application/pdf',
    shareable: true,
    share_token: 'abc123-share-token',
    updated_at: '2026-03-15T10:00:00Z',
  },
  {
    id: 'mat-2',
    title: 'Healthcare Case Study',
    slug: 'healthcare-case-study',
    description: 'How Acme Health reduced costs by 40% with our platform.',
    material_type: 'case_study',
    category: 'Healthcare',
    tags: ['healthcare', 'case-study'],
    file_name: 'healthcare-case-study.pdf',
    file_mime_type: 'application/pdf',
    shareable: true,
    share_token: 'def456-share-token',
    updated_at: '2026-03-12T14:00:00Z',
  },
  {
    id: 'mat-3',
    title: 'Product Overview Deck',
    slug: 'product-overview-deck',
    description: 'Standard slide deck for initial prospect meetings.',
    material_type: 'slide_deck',
    category: 'General',
    tags: ['overview', 'slides'],
    file_name: 'product-overview.pptx',
    file_mime_type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    shareable: false,
    share_token: null,
    updated_at: '2026-03-10T09:00:00Z',
  },
  {
    id: 'mat-4',
    title: 'ROI Calculator Spreadsheet',
    slug: 'roi-calculator-spreadsheet',
    description: 'Interactive ROI calculator for enterprise prospects.',
    material_type: 'roi_calculator',
    category: 'Enterprise',
    tags: ['roi', 'enterprise'],
    file_name: 'roi-calculator.xlsx',
    file_mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    shareable: false,
    share_token: null,
    updated_at: '2026-03-08T16:00:00Z',
  },
]

const mockCategories = [
  { id: 'cat-1', name: 'Enterprise', slug: 'enterprise' },
  { id: 'cat-2', name: 'Healthcare', slug: 'healthcare' },
  { id: 'cat-3', name: 'General', slug: 'general' },
]

export default function TestSalesBrowsePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8" data-testid="test-sales-browse">
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
      <Suspense>
        <SalesTabs
          courses={mockCourses}
          materials={mockMaterials}
          categories={mockCategories}
        />
      </Suspense>
    </div>
  )
}
