'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface MaterialActionsProps {
  materialId: string
  materialTitle: string
}

export function MaterialActions({ materialId, materialTitle }: MaterialActionsProps) {
  const router = useRouter()

  async function handleDelete() {
    if (!window.confirm(`Archive "${materialTitle}"? This will hide it from sales reps.`)) return

    const res = await fetch(`/api/admin/sales-materials/${materialId}`, {
      method: 'DELETE',
    })

    if (res.ok) {
      router.refresh()
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/admin/sales-materials/${materialId}/edit`}
        className="text-sm text-foreground-muted hover:text-accent transition-colors"
      >
        Edit
      </Link>
      <button
        onClick={handleDelete}
        className="text-sm text-foreground-muted hover:text-destructive transition-colors"
      >
        Archive
      </button>
    </div>
  )
}
