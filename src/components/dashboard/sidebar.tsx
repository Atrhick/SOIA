'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { BellRing,
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
  ListChecks,
  MessageSquareText,
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
  Hash,
  Mail,
  UserPlus,
  Handshake,
  X,
  type LucideIcon,
  Sparkles,
  PhoneCall,
  Trophy,
  UsersRound,
  SlidersHorizontal,
  Wallet,
  Contact,
  Gift,
  LifeBuoy,
  Inbox,
  CalendarCheck,
  Home,
} from 'lucide-react'
import { ASSOCIATE_LABELS, isAssociateRole, type AssociateRole } from '@/lib/roles'
import { useMobileNav } from '@/components/dashboard/mobile-nav'

interface SidebarProps {
  role: 'ADMIN' | 'SUB_ADMIN' | 'COACH' | 'AMBASSADOR' | 'PARENT' | AssociateRole
  /** Small count beside a link, by href (e.g. new support messages). */
  badges?: Record<string, number>
  /** Non-admins granted the RUNNING_COSTS feature get an extra "Organization" section. */
  showRunningCosts?: boolean
}

const runningCostsSection: NavSection = {
  title: 'Organization',
  icon: Wallet,
  items: [{ href: '/running-costs', label: 'Running costs', icon: Wallet }],
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
    title: 'Community',
    icon: Sparkles,
    items: [
      { href: '/ambassador/one-a-day', label: 'One-A-Day: Invite', icon: Sparkles },
      { href: '/ambassador/one-a-day/follow-ups', label: 'Follow-ups', icon: ListChecks },
      { href: '/ambassador/one-a-day/playbook', label: 'Playbook', icon: BookOpen },
      { href: '/ambassador/one-a-day/results', label: 'Results', icon: BarChart3 },
      { href: '/ambassador/invite-profile', label: 'Invite profile', icon: Contact },
      { href: '/ambassador/my-team', label: 'My Team', icon: UsersRound },
    ],
  },
  {
    title: 'Assessments',
    icon: FileQuestion,
    items: [
      { href: '/ambassador/surveys', label: 'Surveys & Quizzes', icon: FileQuestion },
    ],
  },
  {
    title: 'Learning',
    icon: GraduationCap,
    items: [
      { href: '/ambassador/learning', label: 'Courses', icon: GraduationCap },
      { href: '/ambassador/knowledge-base', label: 'Knowledge Base', icon: BookOpen },
      { href: '/ambassador/portfolio', label: 'My portfolio', icon: Briefcase },
    ],
  },
  {
    title: 'Business',
    icon: Lightbulb,
    items: [
      { href: '/ambassador/business-idea', label: 'Business Idea', icon: Lightbulb },
      // Shown to every ambassador like the coach entry; the page itself says
      // when Program Pages is not enabled for them.
      { href: '/ambassador/programs', label: 'Program Pages', icon: Megaphone },
    ],
  },
  {
    title: 'Tools',
    icon: Settings,
    items: [
      { href: '/ambassador/time', label: 'Time Clock', icon: Clock },
      { href: '/ambassador/schedule', label: 'Schedule', icon: Calendar },
      { href: '/ambassador/collaboration/channels', label: 'Channels', icon: Hash },
      { href: '/ambassador/collaboration/messages', label: 'Messages', icon: Mail },
    ],
  },
  {
    title: 'Account',
    icon: User,
    items: [
      { href: '/ambassador/profile', label: 'Profile', icon: User },
      { href: '/ambassador/support', label: 'Get help', icon: LifeBuoy },
    ],
  },
]

// Coach navigation - organized into sections
const coachNavSections: NavSection[] = [
  {
    title: 'People',
    icon: Users,
    items: [
      { href: '/coach/one-a-day', label: 'One-A-Day: Invite', icon: Sparkles },
      { href: '/coach/one-a-day/follow-ups', label: 'Follow-ups', icon: ListChecks },
      { href: '/coach/one-a-day/playbook', label: 'Playbook', icon: BookOpen },
      { href: '/coach/one-a-day/results', label: 'Results', icon: BarChart3 },
      { href: '/coach/invite-profile', label: 'Invite profile', icon: Contact },
      { href: '/coach/my-team', label: 'My Team', icon: UsersRound },
      { href: '/coach/discovery-calls', label: 'Discovery Calls', icon: PhoneCall },
      { href: '/coach/ambassadors', label: 'Ambassadors', icon: Users },
      { href: '/coach/groups', label: 'My groups', icon: UsersRound },
      { href: '/coach/portfolio', label: 'Portfolio work', icon: Briefcase },
    ],
  },
  {
    title: 'Assessments',
    icon: FileQuestion,
    items: [
      { href: '/coach/surveys', label: 'Surveys & Quizzes', icon: FileQuestion },
    ],
  },
  {
    title: 'Business',
    icon: TrendingUp,
    items: [
      { href: '/coach/crm', label: 'CRM', icon: UserCheck },
      { href: '/coach/projects', label: 'Projects', icon: FolderKanban },
      { href: '/coach/business-excellence', label: 'Business Excellence', icon: Briefcase },
      { href: '/coach/programs', label: 'Program Pages', icon: Megaphone },
      { href: '/coach/income-goals', label: 'Income & Goals', icon: DollarSign },
    ],
  },
  {
    title: 'Content',
    icon: BookOpen,
    items: [
      { href: '/coach/learning', label: 'Learning', icon: GraduationCap },
      { href: '/coach/knowledge-base', label: 'Knowledge Base', icon: BookOpen },
    ],
  },
  {
    title: 'Communication',
    icon: MessageSquare,
    items: [
      { href: '/coach/collaboration/channels', label: 'Channels', icon: Hash },
      { href: '/coach/collaboration/messages', label: 'Direct Messages', icon: Mail },
      { href: '/coach/collaboration/files', label: 'Files', icon: FileText },
      { href: '/coach/support', label: 'Get help', icon: LifeBuoy },
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
// Shared by all three associate roles - they differ only by label.
const associateNavSections: NavSection[] = [
  {
    title: 'Account',
    icon: UserCog,
    items: [
      { href: '/associate/profile', label: 'My Profile', icon: UserCog },
      { href: '/associate/support', label: 'Get help', icon: LifeBuoy },
    ],
  },
]

// Parents: their home (their child's details) and the conversations they were added to.
const parentNavSections: NavSection[] = [
  {
    title: 'Parent',
    icon: Home,
    items: [
      { href: '/parent', label: 'Home', icon: Home },
      { href: '/parent/messages', label: 'Messages', icon: Mail },
    ],
  },
]

// Sub-admins: only the support inbox (no other admin page is open to them).
const subAdminNavSections: NavSection[] = [
  {
    title: 'Support',
    icon: LifeBuoy,
    items: [
      { href: '/team/support', label: 'Support inbox', icon: Inbox },
    ],
  },
]

const adminNavSections: NavSection[] = [
  {
    title: 'People',
    icon: Users,
    items: [
      { href: '/admin/prospects', label: 'Prospects', icon: UserPlus },
      { href: '/admin/discovery-calls', label: 'Discovery Calls', icon: PhoneCall },
      { href: '/admin/one-a-day', label: 'One-A-Day Leaderboard', icon: Trophy },
      { href: '/admin/users', label: 'User Management', icon: UserCog },
      { href: '/admin/coaches', label: 'Coaches', icon: Users },
      { href: '/admin/ambassadors', label: 'Ambassadors', icon: Users },
      { href: '/admin/associates', label: 'Associates', icon: Handshake },
      { href: '/admin/role-settings', label: 'Role Settings', icon: SlidersHorizontal },
      { href: '/admin/outreach-settings', label: 'Outreach settings', icon: Gift },
      { href: '/admin/outreach-templates', label: 'Message templates', icon: MessageSquareText },
      { href: '/admin/journey-payments', label: 'Journey Payments', icon: Wallet },
    ],
  },
  {
    title: 'Assessments',
    icon: FileQuestion,
    items: [
      { href: '/admin/surveys', label: 'Surveys & Quizzes', icon: FileQuestion },
    ],
  },
  {
    title: 'Onboarding & Training',
    icon: GraduationCap,
    items: [
      { href: '/admin/onboarding', label: 'Onboarding Config', icon: CheckSquare },
      { href: '/admin/ambassador-onboarding', label: 'Amb. Onboarding', icon: ClipboardList },
      { href: '/admin/lms', label: 'Courses', icon: GraduationCap },
      { href: '/admin/business-ideas', label: 'Business Ideas', icon: Lightbulb },
    ],
  },
  {
    title: 'Content',
    icon: BookOpen,
    items: [
      { href: '/admin/knowledge-base', label: 'Knowledge Base', icon: BookOpen },
      { href: '/admin/programs', label: 'Program Pages', icon: Megaphone },
      { href: '/admin/program-pages', label: 'Program page queue', icon: ListChecks },
      { href: '/admin/resource-centers', label: 'Resource Centers', icon: Building2 },
    ],
  },
  {
    title: 'Events & Finance',
    icon: Calendar,
    items: [
      { href: '/admin/calendars', label: 'Calendars', icon: Calendar },
      { href: '/admin/events', label: 'Events', icon: Calendar },
      { href: '/admin/sponsorship', label: 'Sponsorship Requests', icon: HandCoins },
      { href: '/admin/business-excellence', label: 'Business Excellence', icon: Briefcase },
    ],
  },
  {
    title: 'Communication',
    icon: Megaphone,
    items: [
      { href: '/admin/support', label: 'Support inbox', icon: Inbox },
      { href: '/admin/notifications', label: 'Send a notification', icon: BellRing },
      { href: '/admin/collaboration/channels', label: 'Channels', icon: Hash },
      { href: '/admin/collaboration/messages', label: 'Direct Messages', icon: Mail },
      { href: '/admin/collaboration/files', label: 'Files', icon: FileText },
    ],
  },
  {
    title: 'System',
    icon: Shield,
    items: [
      { href: '/admin/features', label: 'Feature Config', icon: Settings2 },
      { href: '/admin/time', label: 'Timesheets', icon: Clock },
      { href: '/admin/reports', label: 'Reports', icon: BarChart3 },
      { href: '/admin/running-costs', label: 'Running costs', icon: Wallet },
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
  badges,
}: {
  section: NavSection
  badges?: Record<string, number>
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
          {!isOpen && section.items.some((i) => badges?.[i.href]) && <span className="h-2 w-2 rounded-full bg-sky-500" aria-hidden="true" />}
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
          isOpen ? 'max-h-[40rem] opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <ul className="mt-1 ml-3 space-y-0.5 border-l-2 border-gray-100 pl-3">
          {section.items.map((item) => {
            const matches = (href: string) => pathname === href || (href !== basePath && pathname.startsWith(href))
            // A more specific sibling (e.g. One-A-Day > My results) wins over its parent link.
            const isActive =
              matches(item.href) &&
              !section.items.some((o) => o.href !== item.href && o.href.length > item.href.length && o.href.startsWith(item.href) && matches(o.href))
            const Icon = item.icon

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  prefetch={true}
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
                  <span className="flex-1">{item.label}</span>
                  {!!badges?.[item.href] && (
                    <span className="rounded-full bg-sky-600 px-2 text-xs font-semibold text-white" aria-label={`${badges[item.href]} new`}>{badges[item.href]}</span>
                  )}
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

export function Sidebar({ role, badges, showRunningCosts = false }: SidebarProps) {
  const pathname = usePathname()
  const mobileNav = useMobileNav()

  const getHomeLink = () => {
    // Associate roles must be handled before the default, or they inherit
    // the coach dashboard and bounce back to /login.
    if (isAssociateRole(role)) return '/associate'
    switch (role) {
      case 'ADMIN': return '/admin'
      case 'SUB_ADMIN': return '/team/support'
      case 'AMBASSADOR': return '/ambassador'
      case 'PARENT': return '/parent'
      default: return '/coach'
    }
  }

  const getPortalLabel = () => {
    if (isAssociateRole(role)) return `${ASSOCIATE_LABELS[role]} Portal`
    switch (role) {
      case 'ADMIN': return 'Admin Portal'
      case 'SUB_ADMIN': return 'Team Portal'
      case 'AMBASSADOR': return 'Ambassador Portal'
      case 'PARENT': return 'Parent Portal'
      default: return 'Coach Portal'
    }
  }

  const basePath = getHomeLink()
  const accentColor = role === 'AMBASSADOR' ? 'amber' : 'primary'

  // Get the sections for the current role
  const getSections = () => {
    // Must come before the switch, exactly like getHomeLink/getPortalLabel.
    // The accordion's active-section state is derived from this list, so
    // falling through to coachNavSections leaves an associate's only menu
    // section permanently collapsed.
    if (isAssociateRole(role)) return associateNavSections
    switch (role) {
      case 'ADMIN': return adminNavSections
      case 'SUB_ADMIN': return subAdminNavSections
      case 'AMBASSADOR': return ambassadorNavSections
      case 'PARENT': return parentNavSections
      default: return coachNavSections
    }
  }

  const baseSections = getSections()
  // Memoised: the effect below depends on this list, so a new array each render must not retrigger it.
  const sections = useMemo(
    () => (showRunningCosts && role !== 'ADMIN' ? [...baseSections, runningCostsSection] : baseSections),
    [baseSections, showRunningCosts, role],
  )

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
      {/* This week - the ambassador's group week, first thing they see */}
      <Link
        href="/ambassador/this-week"
        prefetch={true}
        onClick={handleTopLevelClick}
        className={cn(
          'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 mb-1',
          pathname === '/ambassador/this-week' || pathname.startsWith('/ambassador/this-week/')
            ? 'bg-amber-50 text-amber-700'
            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
        )}
      >
        <CalendarCheck className="h-4 w-4" />
        This week
      </Link>

      {/* Dashboard - always at top, not in a section */}
      <Link
        href={basePath}
        prefetch={true}
        onClick={handleTopLevelClick}
        className={cn(
          'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 mb-1',
          pathname === basePath
            ? 'bg-amber-50 text-amber-700'
            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
        )}
      >
        <LayoutDashboard className="h-4 w-4" />
        Dashboard
      </Link>

      {/* Onboarding for Ambassador */}
      <Link
        href="/ambassador/onboarding"
        prefetch={true}
        onClick={handleTopLevelClick}
        className={cn(
          'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 mb-1',
          pathname === '/ambassador/onboarding' || pathname.startsWith('/ambassador/onboarding/')
            ? 'bg-amber-50 text-amber-700'
            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
        )}
      >
        <ClipboardList className="h-4 w-4" />
        Onboarding
      </Link>

      {/* Collapsible sections */}
      {sections.map((section, index) => (
        <NavSectionComponent
          key={section.title}
          section={section}
          pathname={pathname}
          basePath={basePath}
          accentColor="amber"
          isOpen={openSectionIndex === index}
          onToggle={() => handleSectionToggle(index)}
          badges={badges}
        />
      ))}
    </div>
  )

  // A plain list of links, no sections (sub-admins and parents). A parent's Home link is only active on /parent itself.
  const renderFlatNav = (items: NavItem[]) => (
    <ul className="space-y-1">
      {items.map((item) => {
        const Icon = item.icon
        const active = pathname === item.href || (!(role === 'PARENT' && item.href === basePath) && pathname.startsWith(`${item.href}/`))
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              prefetch={true}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
                active ? 'bg-primary-50 text-primary-700' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
              {!!badges?.[item.href] && <span className="rounded-full bg-sky-600 px-2 text-xs font-semibold text-white" aria-label={`${badges[item.href]} new`}>{badges[item.href]}</span>}
            </Link>
          </li>
        )
      })}
    </ul>
  )

  // Render sectioned navigation for Admin and Coach
  const renderSectionedNav = (navSections: NavSection[]) => (
    <div className="space-y-1">
      {/* Dashboard - always at top, not in a section */}
      <Link
        href={basePath}
        prefetch={true}
        onClick={handleTopLevelClick}
        className={cn(
          'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 mb-1',
          pathname === basePath
            ? 'bg-primary-50 text-primary-700'
            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
        )}
      >
        <LayoutDashboard className="h-4 w-4" />
        Dashboard
      </Link>

      {/* Onboarding for Coach */}
      {role === 'COACH' && (
        <Link
          href="/coach/onboarding"
          prefetch={true}
          onClick={handleTopLevelClick}
          className={cn(
            'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 mb-1',
            pathname === '/coach/onboarding' || pathname.startsWith('/coach/onboarding/')
              ? 'bg-primary-50 text-primary-700'
              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
          )}
        >
          <CheckSquare className="h-4 w-4" />
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
          badges={badges}
        />
      ))}
    </div>
  )

  return (
    <>
    {/* Phones and tablets: the sidebar is a drawer over a dimmed page. */}
    {mobileNav.open && (
      <div
        className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        aria-hidden="true"
        onClick={() => mobileNav.setOpen(false)}
      />
    )}
    <aside
      id="dashboard-sidebar"
      className={cn(
        'fixed left-0 top-0 z-50 h-screen w-64 bg-white border-r border-gray-200 sidebar-shadow transition-[transform,visibility] duration-200 lg:z-40 lg:translate-x-0',
        // Invisible when closed: hides its shadow at the screen edge and keeps
        // its links out of the tab order.
        mobileNav.open ? 'translate-x-0' : '-translate-x-full max-lg:invisible'
      )}
    >
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="relative flex h-16 items-center justify-center border-b border-gray-100 px-4">
          <button
            type="button"
            onClick={() => mobileNav.setOpen(false)}
            aria-label="Close menu"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-gray-500 hover:bg-gray-100 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
          <Link href={getHomeLink()} className="flex items-center gap-3">
            <Image src="/brand/nowtransformed-mark.png" alt="" width={40} height={40} className="w-10 h-10" />
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-gray-900">NowTRANSFORMED</span>
              <span className="text-xs text-gray-500">{getPortalLabel()}</span>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4">
          {role === 'SUB_ADMIN'
            ? renderFlatNav(subAdminNavSections[0].items)
            : role === 'PARENT'
              ? renderFlatNav(parentNavSections[0].items)
            : role === 'AMBASSADOR'
              ? renderAmbassadorNav()
              : renderSectionedNav(sections)}
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-100 p-4">
          <p className="text-xs text-gray-400 text-center">
            NowTRANSFORMED Back Office
          </p>
        </div>
      </div>
    </aside>
    </>
  )
}
