import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth/getProfile'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const profile = await getProfile()

  if (!profile || profile.role !== 'admin') {
    redirect('/training')
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {children}
    </div>
  )
}
