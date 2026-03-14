import { getProfile } from '@/lib/auth/getProfile'
import { TopNav } from '@/components/nav/TopNav'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Auth is enforced by proxy.ts — if we reach here, user is authenticated.
  // getProfile may still return null if cookies aren't forwarded from proxy,
  // so we handle that gracefully instead of redirecting (which causes a loop).
  const profile = await getProfile()
  console.log(`[layout] profile: ${profile?.id ?? 'null'}`)

  return (
    <div className="min-h-screen bg-background">
      {profile && <TopNav profile={profile} />}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}
