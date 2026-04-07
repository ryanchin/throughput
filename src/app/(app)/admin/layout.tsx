import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth/getProfile'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const profile = await getProfile()

  // Allow admin and sales roles. Non-CRM admin pages do their own
  // admin-only checks in their server components (belt-and-suspenders).
  // Sales users can only access /admin/crm/* routes.
  if (!profile || !['admin', 'sales'].includes(profile.role)) {
    redirect('/training')
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {children}
    </div>
  )
}
