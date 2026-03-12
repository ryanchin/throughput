import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth/getProfile'
import { TopNav } from '@/components/nav/TopNav'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const profile = await getProfile()

  if (!profile) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNav profile={profile} />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}
