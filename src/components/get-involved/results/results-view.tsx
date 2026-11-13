import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { channelLabel } from '@/lib/get-involved/outreach-stats'
import type { StreakDayState } from '@/lib/get-involved/outreach-streak'
import { TaskHeader } from '@/components/ui/kit/task-header'
import { HelpTip } from '@/components/ui/kit/help-tip'
import { kit } from '@/components/ui/kit/styles'
import { OneADayNav } from '@/components/get-involved/share-kit/one-a-day-nav'
import { PeopleList } from '@/components/get-involved/one-a-day-client'
import type { ResultsData } from './results-data'

/**
 * "Your results" (One-A-Day v2), shared by /coach and /ambassador one-a-day/results. One job: "Am I doing
 * OK, and what should I do next?" One sentence + one suggested step first, then the detail.
 */

const DAY: Record<StreakDayState, { cls: string; label: string }> = {
  sent: { cls: 'bg-primary-700', label: 'Invited someone' },
  free: { cls: 'bg-sky-200', label: 'Missed, but allowed' },
  missed: { cls: 'bg-gray-200', label: 'Missed' },
  today: { cls: 'bg-white border-2 border-dashed border-gray-400', label: 'Today, not yet' },
}
const at = (key: string) => new Date(`${key}T12:00:00Z`)
const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-US', { ...o, timeZone: 'UTC' })
const wk = fmt({ weekday: 'short' })
const dayNo = fmt({ day: 'numeric' })
const full = fmt({ weekday: 'long', month: 'long', day: 'numeric' })

export function ResultsView({ data, role }: { data: ResultsData; role: 'COACH' | 'AMBASSADOR' }) {
  const base = role === 'COACH' ? '/coach' : '/ambassador'
  const hrefs = { invite: `${base}/one-a-day`, 'follow-ups': `${base}/one-a-day/follow-ups`, playbook: `${base}/one-a-day/playbook` }
  const { streak, funnel, next } = data
  const steps: [string, number][] = [
    ['Invited', funnel.sent], ['Signed up', funnel.forms], ['Booked a call', funnel.booked], ['Came to the call', funnel.attended], ['Joined', funnel.joined],
  ]

  return (
    <div className="max-w-4xl space-y-6">
      <OneADayNav role={role} current="results" followUpsDue={data.followUpsDue} />
      <TaskHeader title="Your results" doThis={`How your invites are going in ${data.monthLabel}, and what to do next.`} />

      <section aria-label="Your next step" className="rounded-2xl border border-primary-200 bg-primary-50 p-4 sm:p-5 space-y-3">
        <p className="text-lg font-semibold leading-snug text-gray-900">{next.sentence}</p>
        <Link href={hrefs[next.to]} className={kit.primary}>{next.button}<ArrowRight className="h-5 w-5" aria-hidden /></Link>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section aria-labelledby="days-h" className={kit.card}>
          <h2 id="days-h" className="flex items-center gap-1 text-lg font-bold text-gray-900">
            Days in a row
            <HelpTip label="What counts as a day?">
              <p>A day counts when you invite at least one person: a message you sent from Invite, an email we sent for you, or someone signing up from your link. Days run on US Central time.</p>
              <p>You can miss 2 days each month and still keep your count. A 3rd missed day in the same month starts it again from zero.</p>
            </HelpTip>
          </h2>
          <p className="mt-1 text-3xl font-bold text-gray-900">{streak.streak} {streak.streak === 1 ? 'day' : 'days'}</p>
          <p className="text-base text-gray-700">
            {streak.doneToday ? 'Today counts already.' : 'Invite someone today to add a day.'}{' '}
            {streak.freeMissesLeft > 0
              ? `You can still miss ${streak.freeMissesLeft} ${streak.freeMissesLeft === 1 ? 'day' : 'days'} this month and keep your count.`
              : 'A missed day this month starts your count again.'}
          </p>
          <ol aria-label="The last 14 days" className="mt-4 grid grid-cols-7 gap-x-1.5 gap-y-3">
            {streak.last14.map((d) => (
              <li key={d.day} className="flex flex-col items-center gap-1">
                <span aria-hidden className={`h-8 w-full max-w-[40px] rounded-md ${DAY[d.state].cls}`} />
                <span aria-hidden className="text-center text-sm leading-tight text-gray-700">{wk.format(at(d.day))}<br /><span className="font-semibold text-gray-900">{dayNo.format(at(d.day))}</span></span>
                <span className="sr-only">{full.format(at(d.day))}: {DAY[d.state].label}</span>
              </li>
            ))}
          </ol>
          <ul aria-label="What the colors mean" className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700">
            {(['sent', 'free', 'missed'] as const).map((k) => (
              <li key={k} className="inline-flex items-center gap-1.5"><span aria-hidden className={`inline-block h-3.5 w-3.5 rounded ${DAY[k].cls}`} />{DAY[k].label}</li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="steps-h" className={kit.card}>
          <h2 id="steps-h" className="flex items-center gap-1 text-lg font-bold text-gray-900">
            Where your invites got to
            <HelpTip label="How these are counted">
              <p>&ldquo;Invited&rdquo; is every invite you sent this month. The next steps follow the people who signed up this month, so each number is part of the one above it.</p>
            </HelpTip>
          </h2>
          <ol className="mt-3 space-y-2">
            {steps.map(([label, v], i) => (
              <li key={label} className="flex items-center gap-3 rounded-xl bg-gray-50 px-3.5 py-2.5">
                <span aria-hidden className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-white text-sm font-bold text-gray-700 ring-1 ring-gray-300">{i + 1}</span>
                <span className="flex-1 text-base text-gray-800">{label}</span>
                <span className="text-xl font-bold text-gray-900">{v}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {data.channels.length > 0 && (
        <section aria-labelledby="channel-h" className={kit.card}>
          <h2 id="channel-h" className="text-lg font-bold text-gray-900">How you reached people</h2>
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {data.channels.map((r) => (
              <li key={r.channel} className="rounded-xl border border-gray-200 px-3.5 py-3">
                <p className="text-base font-semibold text-gray-900">{channelLabel(r.channel)}</p>
                <p className="text-base text-gray-700">{r.sent} invited · {r.forms} signed up · {r.calls} booked a call</p>
              </li>
            ))}
          </ul>
          {data.takeaway && <p className="mt-3 text-base font-semibold text-gray-900">{data.takeaway}</p>}
        </section>
      )}

      <section aria-labelledby="people-h" className={kit.card}>
        <h2 id="people-h" className="mb-1 text-lg font-bold text-gray-900">My people</h2>
        <PeopleList people={data.people} emptyHref={hrefs.invite} />
      </section>

      {data.team.length > 0 && (
        <section aria-labelledby="team-h" className={kit.card}>
          <h2 id="team-h" className="text-lg font-bold text-gray-900">My team <span className="font-semibold text-gray-600">({data.team.length})</span></h2>
          <p className="text-base text-gray-700">People you invited who have joined.</p>
          <ul className="mt-2 divide-y divide-gray-100">{data.team.slice(0, 5).map((p) => <li key={p.id} className="py-2.5 text-base font-semibold text-gray-900">{p.name}</li>)}</ul>
          <Link href={`${base}/my-team`} className={`${kit.quiet} mt-1`}>{data.team.length > 5 ? `See all ${data.team.length} on My team` : 'Open My team'}<ArrowRight className="h-4 w-4" aria-hidden /></Link>
        </section>
      )}

      <section aria-labelledby="group-h" className={kit.card}>
        <h2 id="group-h" className="flex items-center gap-1 text-lg font-bold text-gray-900">
          Your group this month
          <HelpTip label="What is my group?"><p>Each month you&apos;re in a small group of up to 5 people who invite too, so you can cheer each other on. Only your group sees this. New groups start each month.</p></HelpTip>
        </h2>
        {!data.group ? (
          <p className="mt-1 text-base text-gray-700">You&apos;re not in a group this month. New groups start on the 1st, and you&apos;ll be in next month&apos;s.</p>
        ) : (
          <>
            <ul className="mt-2 divide-y divide-gray-100">
              {data.group.rows.map((r, i) => (
                <li key={i} className={`flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2.5 ${r.me ? '-mx-2 rounded-lg bg-sky-50 px-2' : ''}`} aria-current={r.me ? 'true' : undefined}>
                  <span className={`text-base ${r.me ? 'font-bold text-primary-800' : 'font-semibold text-gray-900'}`}>{r.label}</span>
                  <span className="text-base text-gray-700">{r.daysInARow} {r.daysInARow === 1 ? 'day' : 'days'} in a row · {r.callsBooked} {r.callsBooked === 1 ? 'call' : 'calls'} booked</span>
                </li>
              ))}
            </ul>
            {data.group.encouragement && <p className="mt-3 text-base font-semibold text-gray-900">{data.group.encouragement}</p>}
          </>
        )}
      </section>
    </div>
  )
}
