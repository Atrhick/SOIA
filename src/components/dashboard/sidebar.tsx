'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  GraduationCap,
  DollarSign,
  Briefcase,
  Building2,
  Calendar,
  HandCoins,
  MessageSquare,
  Settings,
  BarChart3,
  FileText,
  Lightbulb,
  ClipboardList,
  User,
  BookOpen,
  Clock,
  FolderKanban,
  Settings2,
  UserCog,
  ChevronDown,
  ChevronRight,
  UserCheck,
  Megaphone,
  Shield,
  TrendingUp,
  FileQuestion,
  type LucideIcon,
} from 'lucide-react'

interface SidebarProps {
  role: 'ADMIN' | 'COACH' | 'AMBASSADOR'
}

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

interface NavSection {
  title: string
  icon: LucideIcon
  items: NavItem[]
  defaultOpen?: boolean
}

// Ambassador navigation - organized into sections
const ambassadorNavSections: NavSection[] = [
  {
    title: 'Learning',
    icon: GraduationCap,
    items: [
      { href: '/ambassador/classes', label: 'Classes', icon: GraduationCap },
      { href: '/ambassador/surveys', label: 'Surveys & Quizzes', icon: FileQuestion },
      { href: '/ambassador/knowledge-base', label: 'Knowledge Base', icon: BookOpen },
    ],
  },
  {
    title: 'Business',
    icon: Lightbulb,
    items: [
      { href: '/ambassador/business-idea', label: 'Business Idea', icon: Lightbulb },
    ],
  },
  {
    title: 'Tools',
    icon: Settings,
    items: [
      { href: '/ambassador/time', label: 'Time Clock', icon: Clock },
      { href: '/ambassador/schedule', label: 'Schedule', icon: Calendar },
      { href: '/ambassador/collaboration', label: 'Collaboration', icon: MessageSquare },
    ],
  },
  {
    title: 'Account',
    icon: User,
    items: [
      { href: '/ambassador/profile', label: 'Profile', icon: User },
    ],
  },
]

// Coach navigation - organized into sections
const coachNavSections: NavSection[] = [
  {
    title: 'People',
    icon: Users,
    items: [
      { href: '/coach/ambassadors', label: 'Ambassadors', icon: Users },
    ],
  },
  {
    title: 'Business',
    icon: TrendingUp,
    items: [
      { href: '/coach/crm', label: 'CRM', icon: UserCheck },
      { href: '/coach/projects', label: 'Projects', icon: FolderKanban },
      { href: '/coach/business-excellence', label: 'Business Excellence', icon: Briefcase },
      { href: '/coach/income-goals', label: 'Income & Goals', icon: DollarSign },
    ],
  },
  {
    title: 'Content',
    icon: BookOpen,
    items: [
      { href: '/coach/classes', label: 'My Classes', icon: BookOpen },
      { href: '/coach/courses', label: 'Courses', icon: GraduationCap },
      { href: '/coach/surveys', label: 'Surveys & Quizzes', icon: FileQuestion },
      { href: '/coach/knowledge-base', label: 'Knowledge Base', icon: BookOpen },
    ],
  },
  {
    title: 'Communication',
    icon: MessageSquare,
    items: [
      { href: '/coach/collaboration', label: 'Collaboration', icon: MessageSquare },
      { href: '/coach/messages', label: 'Messages', icon: MessageSquare },
    ],
  },
  {
    title: 'Tools',
    icon: Settings,
    items: [
      { href: '/coach/time', label: 'Time', icon: Clock },
      { href: '/coach/schedule', label: 'Schedule', icon: Calendar },
      { href: '/coach/events', label: 'Events', icon: Calendar },
      { href: '/coach/sponsorship', label: 'Sponsorship', icon: HandCoins },
      { href: '/coach/resource-center', label: 'Resource Center', icon: Building2 },
    ],
  },
]

// Admin navigation - organized into sections
const adminNavSections: NavSection[] = [
  {
    title: 'People',
    icon: Users,
    items: [
      { href: '/admin/users', label: 'User Management', icon: UserCog },
      { href: '/admin/coaches', label: 'Coaches', icon: Users },
      { href: '/admin/ambassadors', label: 'Ambassadors', icon: Users },
    ],
  },
  {
    title: 'Onboarding & Training',
    icon: GraduationCap,
    items: [
      { href: '/admin/onboarding', label: 'Onboarding Config', icon: CheckSquare },
      { href: '/admin/ambassador-onboarding', label: 'Amb. Onboarding', icon: ClipboardList },
      { href: '/admin/courses', label: 'Courses & Quizzes', icon: GraduationCap },
      { href: '/admin/surveys', label: 'Surveys', icon: FileQuestion },
      { href: '/admin/business-ideas', label: 'Business Ideas', icon: Lightbulb },
    ],
  },
  {
    title: 'Content',
    icon: BookOpen,
    items: [
      { href: '/admin/classes', label: 'All Classes', icon: BookOpen },
      { href: '/admin/knowledge-base', label: 'Knowledge Base', icon: BookOpen },
      { href: '/admin/resource-centers', label: 'Resource Centers', icon: Building2 },
    ],
  },
  {
    title: 'Events & Finance',
    icon: Calendar,
    items: [
      { href: '/admin/events', label: 'Events', icon: Calendar },
      { href: '/admin/sponsorship', label: 'Sponsorship Requests', icon: HandCoins },
      { href: '/admin/business-excellence', label: 'Business Excellence', icon: Briefcase },
    ],
  },
  {
    title: 'Communication',
    icon: Megaphone,
    items: [
      { href: '/admin/collaboration', label: 'Collaboration', icon: MessageSquare },
      { href: '/admin/messages', label: 'Messages', icon: MessageSquare },
    ],
  },
  {
    title: 'System',
    icon: Shield,
    items: [
      { href: '/admin/features', label: 'Feature Config', icon: Settings2 },
      { href: '/admin/reports', label: 'Reports', icon: BarChart3 },
      { href: '/admin/audit-logs', label: 'Audit Logs', icon: FileText },
      { href: '/admin/settings', label: 'Settings', icon: Settings },
    ],
  },
]

// Collapsible section component (controlled by parent for accordion behavior)
function NavSectionComponent({
  section,
  pathname,
  basePath,
  accentColor = 'primary',
  isOpen,
  onToggle,
}: {
  section: NavSection
  pathname: string
  basePath: string
  accentColor?: 'primary' | 'amber'
  isOpen: boolean
  onToggle: () => void
}) {
  // Check if any item in section is active
  const hasActiveItem = section.items.some(
    (item) => pathname === item.href || (item.href !== basePath && pathname.startsWith(item.href))
  )

  const SectionIcon = section.icon

  return (
    <div className="mb-1">
      <button
        onClick={onToggle}
        className={cn(
          'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
          hasActiveItem
            ? 'text-gray-900 bg-gray-50'
            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
        )}
      >
        <div className="flex items-center gap-2">
          <SectionIcon className="h-4 w-4" />
          <span>{section.title}</span>
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 transition-transform duration-200',
            !isOpen && '-rotate-90'
          )}
        />
      </button>

      <div
        className={cn(
          'overflow-hidden transition-all duration-200',
          isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <ul className="mt-1 ml-3 space-y-0.5 border-l-2 border-gray-100 pl-3">
          {section.items.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== basePath && pathname.startsWith(item.href))
            const Icon = item.icon

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
                    isActive
                      ? accentColor === 'amber'
                        ? 'bg-amber-50 text-amber-700 border-l-2 border-amber-500 -ml-[2px] pl-[14px]'
                        : 'bg-primary-50 text-primary-700 border-l-2 border-primary-500 -ml-[2px] pl-[14px]'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

// Helper to find which section contains the active item
function findActiveSectionIndex(sections: NavSection[], pathname: string, basePath: string): number | null {
  const index = sections.findIndex(section =>
    section.items.some(item =>
      pathname === item.href || (item.href !== basePath && pathname.startsWith(item.href))
    )
  )
  return index >= 0 ? index : null
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname()

  const getHomeLink = () => {
    switch (role) {
      case 'ADMIN': return '/admin'
      case 'AMBASSADOR': return '/ambassador'
      default: return '/coach'
    }
  }

  const getPortalLabel = () => {
    switch (role) {
      case 'ADMIN': return 'Admin Portal'
      case 'AMBASSADOR': return 'Ambassador Portal'
      default: return 'Coach Portal'
    }
  }

  const basePath = getHomeLink()
  const accentColor = role === 'AMBASSADOR' ? 'amber' : 'primary'

  // Get the sections for the current role
  const getSections = () => {
    switch (role) {
      case 'ADMIN': return adminNavSections
      case 'AMBASSADOR': return ambassadorNavSections
      default: return coachNavSections
    }
  }

  const sections = getSections()

  // Accordion state: track which section index is open (null = none)
  const [openSectionIndex, setOpenSectionIndex] = useState<number | null>(() =>
    findActiveSectionIndex(sections, pathname, basePath)
  )

  // Sync open section when pathname changes
  useEffect(() => {
    const activeIndex = findActiveSectionIndex(sections, pathname, basePath)
    if (activeIndex !== null) {
      setOpenSectionIndex(activeIndex)
    }
  }, [pathname, basePath, sections])

  // Toggle a section - if it's already open, close it; otherwise open it and close others
  const handleSectionToggle = (index: number) => {
    setOpenSectionIndex(prev => prev === index ? null : index)
  }

  // Close all sections when clicking a top-level item
  const handleTopLevelClick = () => {
    setOpenSectionIndex(null)
  }

  // Render sectioned navigation for Ambassador (with amber accent)
  const renderAmbassadorNav = () => (
    <div className="space-y-1">
      {/* Dashboard - always at top, not in a section */}
      <Link
        href={basePath}
        onClick={handleTopLevelClick}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 mb-2',
          pathname === basePath
            ? 'bg-amber-50 text-amber-700 shadow-sm'
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
        )}
      >
        <LayoutDashboard className="h-5 w-5" />
        Dashboard
      </Link>

      {/* Onboarding for Ambassador */}
      <Link
        href="/ambassador/onboarding"
        onClick={handleTopLevelClick}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 mb-4',
          pathname === '/ambassador/onboarding' || pathname.startsWith('/ambassador/onboarding/')
            ? 'bg-amber-50 text-amber-700 shadow-sm'
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
        )}
      >
        <ClipboardList className="h-5 w-5" />
        Onboarding
      </Link>

      {/* Collapsible sections */}
      {ambassadorNavSections.map((section, index) => (
        <NavSectionComponent
          key={section.title}
          section={section}
          pathname={pathname}
          basePath={basePath}
          accentColor="amber"
          isOpen={openSectionIndex === index}
          onToggle={() => handleSectionToggle(index)}
        />
      ))}
    </div>
  )

  // Render sectioned navigation for Admin and Coach
  const renderSectionedNav = (navSections: NavSection[]) => (
    <div className="space-y-1">
      {/* Dashboard - always at top, not in a section */}
      <Link
        href={basePath}
        onClick={handleTopLevelClick}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 mb-4',
          pathname === basePath
            ? 'bg-primary-50 text-primary-700 shadow-sm'
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
        )}
      >
        <LayoutDashboard className="h-5 w-5" />
        Dashboard
      </Link>

      {/* Onboarding for Coach */}
      {role === 'COACH' && (
        <Link
          href="/coach/onboarding"
          onClick={handleTopLevelClick}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 mb-4',
            pathname === '/coach/onboarding' || pathname.startsWith('/coach/onboarding/')
              ? 'bg-primary-50 text-primary-700 shadow-sm'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          )}
        >
          <CheckSquare className="h-5 w-5" />
          Onboarding
        </Link>
      )}

      {/* Collapsible sections */}
      {navSections.map((section, index) => (
        <NavSectionComponent
          key={section.title}
          section={section}
          pathname={pathname}
          basePath={basePath}
          accentColor="primary"
          isOpen={openSectionIndex === index}
          onToggle={() => handleSectionToggle(index)}
        />
      ))}
    </div>
  )

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-white border-r border-gray-200 sidebar-shadow">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center justify-center border-b border-gray-100 px-4">
          <Link href={getHomeLink()} className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center shadow-sm",
              role === 'AMBASSADOR'
                ? 'bg-gradient-to-br from-amber-500 to-amber-600'
                : 'bg-gradient-to-br from-primary-500 to-primary-600'
            )}>
              <span className="text-lg font-bold text-white">S1</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-gray-900">StageOneInAction</span>
              <span className="text-xs text-gray-500">{getPortalLabel()}</span>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4">
          {role === 'ADMIN'
            ? renderSectionedNav(adminNavSections)
            : role === 'COACH'
              ? renderSectionedNav(coachNavSections)
              : renderAmbassadorNav()}
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-100 p-4">
          <p className="text-xs text-gray-400 text-center">
            StageOneInAction Back Office
          </p>
        </div>
      </div>
    </aside>
  )
}
