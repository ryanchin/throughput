import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth/getProfile'
import { BriefingCockpit } from '@/components/admin/crm/BriefingCockpit'

export default async function BriefingPage() {
  const profile = await getProfile()

  if (!profile || !['admin', 'sales'].includes(profile.role)) {
    redirect('/training')
  }

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div>
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Daily Briefing</h1>
          <p className="mt-1 text-sm text-foreground-muted">{today}</p>
        </div>
        <button
          onClick={undefined}
          className="rounded-lg bg-muted border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-raised transition-colors"
          id="print-button"
        >
          Print
        </button>
      </div>

      <div className="mt-8">
        <BriefingCockpit />
      </div>

      {/* Client-side print button handler */}
      <script
        dangerouslySetInnerHTML={{
          __html: `document.getElementById('print-button')?.addEventListener('click', function() { window.print(); });`,
        }}
      />
    </div>
  )
}
