'use client'

import { useState, useEffect } from 'react'
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
  Building2Icon,
  Users2Icon,
  ClockIcon,
  InboxIcon,
  UserPlusIcon,
  ActivityIcon,
  CheckSquareIcon,
  BriefcaseIcon,
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
  const [overdueTaskCount, setOverdueTaskCount] = useState(0)

  const visiblePlatformItems = platformItems.filter(
    (item) => !item.roles || item.roles.includes(profile.role)
  )

  const isAdmin = profile.role === 'admin'
  const hasCrmAccess = ['admin', 'sales'].includes(profile.role)

  useEffect(() => {
    if (!hasCrmAccess) return
    async function fetchTaskStats() {
      try {
        const res = await fetch('/api/admin/crm/tasks/stats')
        if (res.ok) {
          const data = await res.json()
          setOverdueTaskCount(data.overdue_count ?? 0)
        }
      } catch { /* ignore */ }
    }
    fetchTaskStats()
  }, [hasCrmAccess])

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
              <img
                src="/ascendion-logo.webp"
                alt="Ascendion"
                className="aspect-square size-8 rounded-lg object-cover"
              />
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

        {/* CRM section — visible to admin + sales */}
        {hasCrmAccess && (
          <SidebarGroup>
            <SidebarGroupLabel>CRM</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={pathname === '/admin/crm'}
                    tooltip="CRM Dashboard"
                    render={<Link href="/admin/crm" />}
                  >
                    <Building2Icon className="size-4" />
                    <span>Dashboard</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={isActive('/admin/crm/companies')}
                    tooltip="Companies"
                    render={<Link href="/admin/crm/companies" />}
                  >
                    <Building2Icon className="size-4" />
                    <span>Companies</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={isActive('/admin/crm/opportunities')}
                    tooltip="Pipeline"
                    render={<Link href="/admin/crm/opportunities" />}
                  >
                    <BarChart3Icon className="size-4" />
                    <span>Pipeline</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={isActive('/admin/crm/activities')}
                    tooltip="Activities"
                    render={<Link href="/admin/crm/activities" />}
                  >
                    <FileTextIcon className="size-4" />
                    <span>Activities</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={isActive('/admin/crm/tasks')}
                    tooltip="Tasks"
                    render={<Link href="/admin/crm/tasks" />}
                  >
                    <CheckSquareIcon className="size-4" />
                    <span>Tasks</span>
                    {overdueTaskCount > 0 && (
                      <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-[var(--destructive)] text-[10px] font-bold text-white">
                        {overdueTaskCount}
                      </span>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Resources section — visible to admin + sales */}
        {hasCrmAccess && (
          <SidebarGroup>
            <SidebarGroupLabel>Resources</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={pathname === '/admin/crm/resources' || (pathname.startsWith('/admin/crm/resources/') && !pathname.includes('/rolloffs') && !pathname.includes('/bench') && !pathname.includes('/candidates') && !pathname.includes('/roles') && !pathname.includes('/capacity'))}
                    tooltip="Roster"
                    render={<Link href="/admin/crm/resources" />}
                  >
                    <Users2Icon className="size-4" />
                    <span>Roster</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={isActive('/admin/crm/resources/rolloffs')}
                    tooltip="Rolloffs"
                    render={<Link href="/admin/crm/resources/rolloffs" />}
                  >
                    <ClockIcon className="size-4" />
                    <span>Rolloffs</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={isActive('/admin/crm/resources/bench')}
                    tooltip="Bench"
                    render={<Link href="/admin/crm/resources/bench" />}
                  >
                    <InboxIcon className="size-4" />
                    <span>Bench</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={isActive('/admin/crm/resources/candidates')}
                    tooltip="Candidates"
                    render={<Link href="/admin/crm/resources/candidates" />}
                  >
                    <UserPlusIcon className="size-4" />
                    <span>Candidates</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={isActive('/admin/crm/resources/roles')}
                    tooltip="Roles"
                    render={<Link href="/admin/crm/resources/roles" />}
                  >
                    <BriefcaseIcon className="size-4" />
                    <span>Roles</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={isActive('/admin/crm/resources/capacity')}
                    tooltip="Capacity"
                    render={<Link href="/admin/crm/resources/capacity" />}
                  >
                    <ActivityIcon className="size-4" />
                    <span>Capacity</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

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
