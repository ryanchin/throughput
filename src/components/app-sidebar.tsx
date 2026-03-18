'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BookOpenIcon,
  FileTextIcon,
  BarChart3Icon,
  AwardIcon,
  LayoutDashboardIcon,
  GraduationCapIcon,
  UsersIcon,
  FolderOpenIcon,
} from 'lucide-react'
import type { Database } from '@/lib/supabase/database.types'
import { NavUserInternal } from '@/components/nav-user-internal'
import { SearchTrigger } from '@/components/search/SearchTrigger'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'

type Profile = Database['public']['Tables']['profiles']['Row']

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  profile: Profile
}

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  roles?: string[] // if undefined, visible to all
}

const platformItems: NavItem[] = [
  {
    title: 'Training',
    href: '/training',
    icon: BookOpenIcon,
    roles: ['employee', 'sales', 'admin'],
  },
  {
    title: 'Knowledge',
    href: '/knowledge',
    icon: FileTextIcon,
    roles: ['employee', 'sales', 'admin'],
  },
  {
    title: 'Sales',
    href: '/sales',
    icon: BarChart3Icon,
    roles: ['sales', 'admin'],
  },
  {
    title: 'Certifications',
    href: '/certifications',
    icon: AwardIcon,
  },
  {
    title: 'Docs',
    href: '/docs',
    icon: BookOpenIcon,
  },
]

const adminItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/admin',
    icon: LayoutDashboardIcon,
  },
  {
    title: 'Courses',
    href: '/admin/courses',
    icon: GraduationCapIcon,
  },
  {
    title: 'Certifications',
    href: '/admin/certifications',
    icon: AwardIcon,
  },
  {
    title: 'Knowledge',
    href: '/admin/knowledge',
    icon: FileTextIcon,
  },
  {
    title: 'Docs',
    href: '/admin/docs',
    icon: BookOpenIcon,
  },
  {
    title: 'Sales Materials',
    href: '/admin/sales-materials',
    icon: FolderOpenIcon,
  },
  {
    title: 'Users',
    href: '/admin/users',
    icon: UsersIcon,
  },
]

export function AppSidebar({ profile, ...props }: AppSidebarProps) {
  const pathname = usePathname()

  const visiblePlatformItems = platformItems.filter(
    (item) => !item.roles || item.roles.includes(profile.role)
  )

  const isAdmin = profile.role === 'admin'

  function isActive(href: string): boolean {
    // For /admin, exact match only (don't highlight for /admin/courses etc.)
    if (href === '/admin') {
      return pathname === '/admin'
    }
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/training" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-gradient-brand text-sm font-bold text-white">
                PS
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Product Studio</span>
                <span className="truncate text-xs text-sidebar-foreground/60">
                  Throughput
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SearchTrigger scope="all" placeholder="Search..." />

        {/* Platform section */}
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visiblePlatformItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={isActive(item.href)}
                    tooltip={item.title}
                    render={<Link href={item.href} />}
                  >
                    <item.icon className="size-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Admin section */}
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={isActive(item.href)}
                      tooltip={item.title}
                      render={<Link href={item.href} />}
                    >
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <NavUserInternal
          user={{
            name: profile.full_name || '',
            email: profile.email,
            role: profile.role,
          }}
        />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
