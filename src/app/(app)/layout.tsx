import { getProfile } from '@/lib/auth/getProfile'
import { AppSidebar } from '@/components/app-sidebar'
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'

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

  if (!profile) {
    return (
      <div className="min-h-screen bg-background">
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    )
  }

  return (
    <SidebarProvider>
      <AppSidebar profile={profile} />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-sidebar-border px-4">
          <SidebarTrigger className="-ml-1 text-foreground-muted hover:text-foreground" />
          <Separator orientation="vertical" className="mr-2 !h-4" />
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
