import { SENDER_STATUS_LABEL, TEAM_STATUS_LABEL, type SupportStatus } from '@/lib/support/core'
import { cn } from '@/lib/utils'

const COLORS: Record<SupportStatus, string> = {
  NEW: 'bg-sky-100 text-sky-800',
  ASSIGNED: 'bg-violet-100 text-violet-800',
  WAITING_ON_SENDER: 'bg-amber-100 text-amber-900',
  DONE: 'bg-green-100 text-green-800',
}

export function StatusPill({ status, audience }: { status: SupportStatus; audience: 'sender' | 'team' }) {
  const label = audience === 'sender' ? SENDER_STATUS_LABEL[status] : TEAM_STATUS_LABEL[status]
  return <span className={cn('inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-sm font-medium', COLORS[status])}>{label}</span>
}

export const fmtWhen = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' }).format(new Date(iso)) + ' CT'
