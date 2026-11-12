/** E10 "Your orientation is ready to watch" (at the chosen time, and once more 3 days later). See ./index.ts. */
import { Mail, P, SMALL, esc, layout } from '../emails'

export function orientationReminderEmail(p: {
  firstName: string
  roleLabel: string
  minutes: number | null
  watchUrl: string
  /** 'planned' = the time they picked; 'repeat' = still not watched a few days later; 'nudge' = never picked a time. */
  kind: 'planned' | 'repeat' | 'nudge'
  parentFirst?: string | null
  prospectId?: string | null
}): Mail {
  const role = p.roleLabel.toLowerCase()
  const length = p.minutes ? `It's about ${p.minutes} minutes, and you can pause any time.` : 'You can pause any time.'
  const opener = p.kind === 'planned'
    ? `here's the ${esc(role)} orientation you planned to watch.`
    : p.kind === 'repeat'
      ? `your ${esc(role)} orientation is still waiting for you.`
      : `your ${esc(role)} orientation is ready whenever you are.`
  const parent = p.parentFirst
    ? `<div style="background:#fff7ed;border:1px solid #fdba74;border-radius:12px;padding:12px 14px;margin:0 0 14px;color:#7c2d12;font-size:14px;line-height:1.5">Hi ${esc(p.parentFirst)}, we're copying you because ${esc(p.firstName)} is 17 or under. It's a great one to watch together.</div>`
    : ''
  return {
    subject: `Your ${role} orientation is ready to watch`,
    html: layout(
      `${parent}<p style="${P}">Hi ${esc(p.firstName)}, ${opener} ${length}</p>`,
      { label: 'Watch orientation', url: p.watchUrl },
      `<p style="${SMALL}">Not a good time? <a href="${esc(p.watchUrl)}?later=1" style="color:#0369a1">Pick another time</a>.</p>`,
      { prospectId: p.prospectId },
    ),
  }
}
