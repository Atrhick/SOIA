import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { TaskHeader } from '@/components/ui/kit/task-header'
import { HelpTip } from '@/components/ui/kit/help-tip'
import { InviteClient } from '@/components/get-involved/invite/invite-client'
import { loadInvitePage } from './data'
import { OneADayNav } from './one-a-day-nav'

/** In plain words: how many days in a row they've invited someone. Never "streak". */
function progressNote(days: number, doneToday: boolean): string {
  if (doneToday) return days > 1 ? `You've invited someone ${days} days in a row` : 'Done for today ✓'
  if (days > 0) return `${days} ${days === 1 ? 'day' : 'days'} in a row. Invite someone today to keep it going.`
  return 'Invite one person today'
}

/** One-A-Day "Invite" for coaches and ambassadors: invite someone today, in under a minute. */
export async function OneADayPage({ role }: { role: 'COACH' | 'AMBASSADOR' }) {
  const session = await auth()
  if (!session || session.user.role !== role) redirect('/login')
  const base = role === 'COACH' ? '/coach' : '/ambassador'
  const data = await loadInvitePage(session.user.id, role)

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-24">
      <OneADayNav role={role} current="invite" followUpsDue={data.followUpsDue} />
      <TaskHeader
        title="Invite someone today"
        doThis="Email an invite, or copy a message to send yourself."
        aside={
          <p className={`flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold ${data.doneToday ? 'bg-green-50 text-green-900' : 'bg-gray-100 text-gray-800'}`}>
            <span>{progressNote(data.daysInARow, data.doneToday)}</span>
            <HelpTip label="How days are counted">
              <p>A day counts when you invite at least one person: an email we send for you, or a message you copied and marked as sent.</p>
              <p>Missed a day? Up to 2 days a month won&apos;t break your run.</p>
            </HelpTip>
          </p>
        }
      />
      <InviteClient data={data} profileHref={`${base}/invite-profile`} />
    </div>
  )
}
