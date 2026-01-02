'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  GraduationCap,
  Target,
  DollarSign,
  Briefcase,
  Building2,
  Calendar,
  HandCoins,
  MessageSquare,
  Settings,
  BarChart3,
  FileText,
} from 'lucide-react'

interface SidebarProps {
  role: 'ADMIN' | 'COACH'
}

const coachNavItems = [
  { href: '/coach', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/coach/onboarding', label: 'Onboarding', icon: CheckSquare },
  { href: '/coach/ambassadors', label: 'Ambassadors', icon: Users },
  { href: '/coach/courses', label: 'Courses', icon: GraduationCap },
  { href: '/coach/income-goals', label: 'Income & Goals', icon: DollarSign },
  { href: '/coach/business-excellence', label: 'Business Excellence', icon: Briefcase },
  { href: '/coach/resource-center', label: 'Resource Center', icon: Building2 },
  { href: '/coach/events', label: 'Events', icon: Calendar },
  { href: '/coach/sponsorship', label: 'Sponsorship', icon: HandCoins },
  { href: '/coach/messages', label: 'Messages', icon: MessageSquare },
]

const adminNavItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/coaches', label: 'Coaches', icon: Users },
  { href: '/admin/ambassadors', label: 'Ambassadors', icon: Users },
  { href: '/admin/onboarding', label: 'Onboarding Config', icon: CheckSquare },
  { href: '/admin/courses', label: 'Courses & Quizzes', icon: GraduationCap },
  { href: '/admin/business-excellence', label: 'Business Excellence', icon: Briefcase },
  { href: '/admin/events', label: 'Events', icon: Calendar },
  { href: '/admin/sponsorship', label: 'Sponsorship Requests', icon: HandCoins },
  { href: '/admin/resource-centers', label: 'Resource Centers', icon: Building2 },
  { href: '/admin/reports', label: 'Reports', icon: BarChart3 },
  { href: '/admin/messages', label: 'Messages', icon: MessageSquare },
  { href: '/admin/audit-logs', label: 'Audit Logs', icon: FileText },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
]

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname()
  const navItems = role === 'ADMIN' ? adminNavItems : coachNavItems

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-white border-r border-gray-200">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center justify-center border-b border-gray-200 px-4">
          <Link href={role === 'ADMIN' ? '/admin' : '/coach'} className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
              <span className="text-lg font-bold text-white">S1</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-gray-900">StageOneInAction</span>
              <span className="text-xs text-gray-500">{role === 'ADMIN' ? 'Admin' : 'Coach'} Portal</span>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href ||
                (item.href !== `/${role.toLowerCase()}` && pathname.startsWith(item.href))
              const Icon = item.icon

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4">
          <p className="text-xs text-gray-500 text-center">
            StageOneInAction Back Office
          </p>
        </div>
      </div>
    </aside>
  )
}
