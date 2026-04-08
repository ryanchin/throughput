import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getProfile } from '@/lib/auth/getProfile'
import { DigestSettings } from '@/components/admin/crm/DigestSettings'

export default async function DigestSettingsPage() {
  const profile = await getProfile()

  if (!profile || !['admin', 'sales'].includes(profile.role)) {
    redirect('/training')
  }

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-foreground-muted mb-6">
        <Link href="/admin/crm" className="hover:text-accent transition-colors">
          CRM
        </Link>
        <span>/</span>
        <span className="text-foreground">Settings</span>
        <span>/</span>
        <span className="text-foreground">Digest</span>
      </nav>

      <div>
        <h1 className="text-3xl font-bold text-foreground">Digest Preferences</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Configure your daily email digest with action items and pipeline updates.
        </p>
      </div>

      <div className="mt-8 max-w-xl">
        <DigestSettings />
      </div>
    </div>
  )
}
