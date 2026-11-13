/**
 * One-A-Day v2 "Your results": pure rules (tested in results-rules.test.ts).
 * - groupLabels: first name + last initial, made unique within the group (city, then a number); "(you)" for me.
 * - nextStep: the one sentence and the one suggested button at the top of the page.
 */

export interface GroupPerson { id: string; first: string | null; last: string | null; city: string | null; me: boolean }

const clean = (s: string | null | undefined) => (s ?? '').trim()
const initial = (last: string) => (last ? ` ${last[0].toUpperCase()}.` : '')

export function groupLabels(people: GroupPerson[]): Map<string, string> {
  const base = new Map(people.map((p) => [p.id, `${clean(p.first) || 'Member'}${initial(clean(p.last))}`]))
  const count = (label: string, of: Map<string, string>) => Array.from(of.values()).filter((v) => v.toLowerCase() === label.toLowerCase()).length
  const out = new Map<string, string>()
  // 1. Same short name as someone else: add the city when we know it.
  for (const p of people) {
    const b = base.get(p.id)!
    const city = clean(p.city)
    out.set(p.id, count(b, base) > 1 && city ? `${b} (${city})` : b)
  }
  // 2. Still the same (no city, or same city): number the others in a stable order ("(you)" already sets me apart).
  const others = people.filter((p) => !p.me).sort((a, b) => a.id.localeCompare(b.id))
  const snapshot = new Map(others.map((p) => [p.id, out.get(p.id)!.toLowerCase()]))
  const seen = new Map<string, number>()
  for (const p of others) {
    const key = snapshot.get(p.id)!
    if (Array.from(snapshot.values()).filter((v) => v === key).length < 2) continue
    const n = (seen.get(key) ?? 0) + 1
    seen.set(key, n)
    out.set(p.id, `${out.get(p.id)} ${n}`)
  }
  for (const p of people) if (p.me) out.set(p.id, `${out.get(p.id)} (you)`)
  return out
}

export interface NextStepFacts {
  daysInARow: number
  doneToday: boolean
  /** Follow-ups due today (all kinds). */
  followUpsDue: number
  /** Of those: signed up but no call booked. */
  noCall: number
  invitedThisMonth: number
}

export interface NextStep { sentence: string; button: string; to: 'invite' | 'follow-ups' | 'playbook' }

const people = (n: number) => (n === 1 ? '1 person' : `${n} people`)

export function nextStep(f: NextStepFacts): NextStep {
  if (f.noCall > 0) {
    return { sentence: `${people(f.noCall)} signed up but ${f.noCall === 1 ? "hasn't" : "haven't"} booked a call yet.`, button: 'Follow up now', to: 'follow-ups' }
  }
  if (f.followUpsDue > 0) {
    return { sentence: `${people(f.followUpsDue)} ${f.followUpsDue === 1 ? 'is' : 'are'} ready for a short check-in today.`, button: 'Follow up now', to: 'follow-ups' }
  }
  if (f.doneToday) {
    return {
      sentence: f.daysInARow > 1 ? `You've invited someone ${f.daysInARow} days in a row, including today. Nice work.` : "You've invited someone today. Nice work.",
      button: 'Get ideas for tomorrow',
      to: 'playbook',
    }
  }
  if (f.daysInARow > 0) {
    return { sentence: `You've invited someone ${f.daysInARow} day${f.daysInARow === 1 ? '' : 's'} in a row. Keep it going.`, button: 'Invite someone today', to: 'invite' }
  }
  if (f.invitedThisMonth === 0) {
    return { sentence: "You haven't invited anyone this month yet. Start with one person you know.", button: 'Invite someone today', to: 'invite' }
  }
  return { sentence: 'Invite one person today to start a new run of days.', button: 'Invite someone today', to: 'invite' }
}
