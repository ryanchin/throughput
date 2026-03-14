'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRightIcon } from 'lucide-react'
import type { NavTreeNode } from '@/lib/knowledge/nav-tree'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarRail,
} from '@/components/ui/sidebar'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { SearchTrigger } from '@/components/search/SearchTrigger'

interface DocsSidebarShadcnProps {
  tree: NavTreeNode[]
  currentSlug: string
}

export function DocsSidebarShadcn({ tree, currentSlug }: DocsSidebarShadcnProps) {
  return (
    <Sidebar collapsible="offcanvas" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4 pb-2">
        <Link href="/" className="bg-gradient-brand bg-clip-text text-lg font-bold text-transparent">
          AAVA Product Studio
        </Link>
        <span className="w-fit rounded-md bg-accent-muted px-2 py-0.5 text-xs font-medium text-accent">
          Docs
        </span>
      </SidebarHeader>

      <SidebarContent>
        <SearchTrigger scope="docs" placeholder="Search docs..." />

        {tree.map((node) => {
          const hasChildren = node.children.length > 0

          if (!hasChildren) {
            return (
              <SidebarGroup key={node.id}>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={currentSlug === node.fullPath}
                      render={<Link href={`/docs/${node.fullPath}`} />}
                    >
                      <span>{node.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroup>
            )
          }

          return (
            <CollapsibleGroup
              key={node.id}
              node={node}
              currentSlug={currentSlug}
            />
          )
        })}
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  )
}

/** Top-level collapsible group — controlled to avoid Base UI warning. */
function CollapsibleGroup({ node, currentSlug }: { node: NavTreeNode; currentSlug: string }) {
  const isGroupActive = currentSlug === node.fullPath || currentSlug.startsWith(node.fullPath + '/')
  const [open, setOpen] = useState(isGroupActive)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <SidebarGroup>
        <SidebarGroupLabel>
          <Link
            href={`/docs/${node.fullPath}`}
            className="flex-1 truncate hover:text-sidebar-accent-foreground"
          >
            {node.title}
          </Link>
          <CollapsibleTrigger className="ml-auto flex size-5 shrink-0 items-center justify-center rounded-md hover:bg-sidebar-accent">
            <ChevronRightIcon className="size-3.5 transition-transform duration-200 [[data-panel-open]_&]:rotate-90" />
          </CollapsibleTrigger>
        </SidebarGroupLabel>

        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              {node.children.map((child) => (
                <NavTreeItem
                  key={child.id}
                  node={child}
                  currentSlug={currentSlug}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  )
}

/** Renders a nav tree node as a sidebar menu item (with optional collapsible children). */
function NavTreeItem({ node, currentSlug }: { node: NavTreeNode; currentSlug: string }) {
  const isActive = currentSlug === node.fullPath
  const hasChildren = node.children.length > 0

  if (!hasChildren) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          isActive={isActive}
          render={<Link href={`/docs/${node.fullPath}`} />}
        >
          <span>{node.title}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  const containsActive = currentSlug.startsWith(node.fullPath + '/')
  return <CollapsibleNavItem node={node} currentSlug={currentSlug} initialOpen={isActive || containsActive} />
}

/** Controlled collapsible for mid-level nav items. */
function CollapsibleNavItem({ node, currentSlug, initialOpen }: { node: NavTreeNode; currentSlug: string; initialOpen: boolean }) {
  const [open, setOpen] = useState(initialOpen)
  const isActive = currentSlug === node.fullPath

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <SidebarMenuItem>
        <SidebarMenuButton
          isActive={isActive}
          render={<Link href={`/docs/${node.fullPath}`} />}
        >
          <span>{node.title}</span>
        </SidebarMenuButton>
        <CollapsibleTrigger className="absolute right-1 top-1.5 flex size-5 items-center justify-center rounded-md hover:bg-sidebar-accent">
          <ChevronRightIcon className="size-3 transition-transform duration-200 [[data-panel-open]_&]:rotate-90" />
        </CollapsibleTrigger>
      </SidebarMenuItem>

      <CollapsibleContent>
        <SidebarMenuSub>
          {node.children.map((child) => (
            <NavSubTreeItem
              key={child.id}
              node={child}
              currentSlug={currentSlug}
            />
          ))}
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  )
}

/** Renders nested sub-menu items recursively. */
function NavSubTreeItem({ node, currentSlug }: { node: NavTreeNode; currentSlug: string }) {
  const isActive = currentSlug === node.fullPath
  const hasChildren = node.children.length > 0

  if (!hasChildren) {
    return (
      <SidebarMenuSubItem>
        <SidebarMenuSubButton
          isActive={isActive}
          render={<Link href={`/docs/${node.fullPath}`} />}
        >
          <span>{node.title}</span>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
    )
  }

  const containsActive = currentSlug.startsWith(node.fullPath + '/')
  return <CollapsibleSubItem node={node} currentSlug={currentSlug} initialOpen={isActive || containsActive} />
}

/** Controlled collapsible for deeply nested sub-items. */
function CollapsibleSubItem({ node, currentSlug, initialOpen }: { node: NavTreeNode; currentSlug: string; initialOpen: boolean }) {
  const [open, setOpen] = useState(initialOpen)
  const isActive = currentSlug === node.fullPath

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <SidebarMenuSubItem>
        <SidebarMenuSubButton
          isActive={isActive}
          render={<Link href={`/docs/${node.fullPath}`} />}
        >
          <span>{node.title}</span>
        </SidebarMenuSubButton>
        <CollapsibleTrigger className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-md hover:bg-sidebar-accent">
          <ChevronRightIcon className="size-2.5 transition-transform duration-200 [[data-panel-open]_&]:rotate-90" />
        </CollapsibleTrigger>
      </SidebarMenuSubItem>

      <CollapsibleContent>
        <SidebarMenuSub>
          {node.children.map((child) => (
            <NavSubTreeItem
              key={child.id}
              node={child}
              currentSlug={currentSlug}
            />
          ))}
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  )
}
