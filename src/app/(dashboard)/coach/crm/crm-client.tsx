'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { AlertCircle, ArrowRight, CheckCircle2, Clock, Users } from 'lucide-react'

export interface ContactRow {
  id: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  jobTitle: string | null
  source: string
  status: string
  createdAt: string
  lastContactedAt: string | null
  nextFollowUpAt: string | null
  programName: string | null
  association: string | null
  completedForm: boolean | null
  activityCount: number
}

const STATUS_META: Record<
  string,
  { label: string; variant: 'default' | 'success' | 'warning' | 'destructive' | 'outline' | 'info' }
> = {
  NEW: { label: 'New', variant: 'warning' },
  CONTACTED: { label: 'Contacted', variant: 'info' },
  QUALIFIED: { label: 'Qualified', variant: 'default' },
  CONVERTED: { label: 'Converted', variant: 'success' },
  DORMANT: { label: 'Dormant', variant: 'outline' },
  LOST: { label: 'Lost', variant: 'outline' },
}

const FILTERS: { key: string; label: string }[] = [
  { key: 'NEEDS_ATTENTION', label: 'Needs attention' },
  { key: 'ALL', label: 'Everyone' },
  { key: 'NEW', label: 'New' },
  { key: 'CONTACTED', label: 'Contacted' },
  { key: 'QUALIFIED', label: 'Qualified' },
  { key: 'CONVERTED', label: 'Converted' },
]

function dueLabel(iso: string | null): { text: string; overdue: boolean } | null {
  if (!iso) return null
  const due = new Date(iso)
  const today = new Date()
  const days = Math.round((due.getTime() - today.getTime()) / 86400000)
  if (days < 0) return { text: `${Math.abs(days)}d overdue`, overdue: true }
  if (days === 0) return { text: 'Due today', overdue: true }
  return { text: `in ${days}d`, overdue: false }
}

export function CrmClient({
  contacts,
  counts,
  needsAttention,
  activeFilter,
}: {
  contacts: ContactRow[]
  counts: Record<string, number>
  needsAttention: number
  activeFilter: string
}) {
  const router = useRouter()
  const total = Object.values(counts).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Contacts</h1>
        <p className="text-gray-500 mt-1">
          Everyone who has come to you through a program page, and anyone you add yourself.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Stat
          label="Need attention"
          value={needsAttention}
          icon={AlertCircle}
          tone={needsAttention > 0 ? 'amber' : 'gray'}
        />
        <Stat label="Total contacts" value={total} icon={Users} tone="gray" />
        <Stat label="Qualified" value={counts.QUALIFIED ?? 0} icon={CheckCircle2} tone="gray" />
        <Stat label="Converted" value={counts.CONVERTED ?? 0} icon={CheckCircle2} tone="green" />
      </div>

      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => {
          const active = activeFilter === f.key
          const count =
            f.key === 'NEEDS_ATTENTION' ? needsAttention : f.key === 'ALL' ? total : counts[f.key] ?? 0
          return (
            <button
              key={f.key}
              onClick={() => router.push(`/coach/crm?filter=${f.key}`)}
              className={
                active
                  ? 'rounded-full bg-primary-600 text-white px-3.5 py-1.5 text-sm font-medium'
                  : 'rounded-full bg-white border border-gray-300 text-gray-700 px-3.5 py-1.5 text-sm hover:bg-gray-50'
              }
            >
              {f.label} ({count})
            </button>
          )
        })}
      </div>

      {contacts.length === 0 ? (
        <EmptyState
          icon={Users}
          title={
            activeFilter === 'NEEDS_ATTENTION'
              ? 'Nothing needs your attention'
              : 'No contacts here yet'
          }
          description={
            activeFilter === 'NEEDS_ATTENTION'
              ? 'Everyone has been contacted and no follow-ups are due. Switch to Everyone to see your full list.'
              : 'Contacts appear here when someone signs up through one of your program pages.'
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-gray-100">
              {contacts.map((c) => {
                const meta = STATUS_META[c.status] ?? { label: c.status, variant: 'outline' as const }
                const due = dueLabel(c.nextFollowUpAt)
                return (
                  <li key={c.id}>
                    <Link
                      href={`/coach/crm/${c.id}`}
                      className="flex items-center gap-4 p-4 hover:bg-gray-50"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-900">
                            {c.firstName} {c.lastName}
                          </span>
                          <Badge variant={meta.variant}>{meta.label}</Badge>
                          {c.completedForm === false && (
                            <Badge variant="outline" className="text-xs">
                              Form not completed
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 truncate">
                          {[c.jobTitle, c.email].filter(Boolean).join(' · ')}
                          {c.programName ? ` · ${c.programName}` : ''}
                        </p>
                      </div>

                      <div className="text-right shrink-0 hidden sm:block">
                        {due ? (
                          <p
                            className={
                              due.overdue
                                ? 'text-sm font-medium text-amber-700 inline-flex items-center gap-1'
                                : 'text-sm text-gray-500 inline-flex items-center gap-1'
                            }
                          >
                            <Clock className="h-3.5 w-3.5" />
                            {due.text}
                          </p>
                        ) : (
                          <p className="text-sm text-gray-400">No follow-up set</p>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5">
                          {c.activityCount === 0
                            ? 'No contact yet'
                            : `${c.activityCount} interaction${c.activityCount === 1 ? '' : 's'}`}
                        </p>
                      </div>

                      <ArrowRight className="h-4 w-4 text-gray-300 shrink-0" />
                    </Link>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string
  value: number
  icon: typeof Users
  tone: 'amber' | 'green' | 'gray'
}) {
  const tones = {
    amber: 'bg-amber-100 text-amber-700',
    green: 'bg-green-100 text-green-700',
    gray: 'bg-gray-100 text-gray-600',
  }
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <div className={`p-2 rounded-lg ${tones[tone]}`}>
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-sm text-gray-500">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
