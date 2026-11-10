/**
 * Where one of an inviter's people is in the journey, worded for the inviter's "My people" list.
 * The badge reuses the admin prospects list's stages (listStageFor / stageBadgeLabel / stageBadgeClass),
 * so both lists always agree. Pure, so it is unit tested (inviter-people.test.ts).
 */
import { callWhen, listStageFor, relativeDay, stageBadgeClass, stageBadgeLabel } from '../../app/(dashboard)/admin/prospects/journey-list'

export interface InviterPersonFacts {
  status: string
  userId: string | null
  noShowCount: number
  createdAt: Date
  added: boolean
  bookedCallAt: Date | null
  missedCallAt: Date | null
  orientationRemindAt: Date | null
  paymentStatus: string | null
  joinedAt: Date | null
}

export interface PersonStage {
  /** Badge text, e.g. "Assessment". */
  label: string
  /** Tailwind classes for the badge. */
  cls: string
  /** What they are doing now, e.g. "Answer 3 questions". Never includes private details (answers, reasons). */
  detail: string
}

export function inviterPersonStage(f: InviterPersonFacts, now: Date): PersonStage {
  const stage = listStageFor(f)
  const label = stageBadgeLabel(stage, f.status)
  const cls = stageBadgeClass(stage, f.status)
  const signed = `${f.added ? 'Added' : 'Signed up'} ${relativeDay(f.createdAt, now)}`
  let detail: string
  switch (stage) {
    case 'FORM':
      detail = f.status === 'AWAITING_PARENT_CONSENT' ? `${signed} · needs a parent's okay` : `${signed} · needs to book a call`
      break
    case 'CALL_BOOKED':
      detail = f.bookedCallAt
        ? f.bookedCallAt.getTime() > now.getTime() ? `Call ${callWhen(f.bookedCallAt, now)}` : `Call was ${callWhen(f.bookedCallAt, now)}`
        : 'Call booked'
      break
    case 'CALL_KEPT':
      detail = 'Call kept · role being chosen'
      break
    case 'ASSESSMENT':
      detail = 'Answer 3 questions'
      break
    case 'ORIENTATION':
      detail = f.status === 'ORIENTATION_SCHEDULED' && f.orientationRemindAt && f.orientationRemindAt.getTime() > now.getTime()
        ? `Watching orientation ${callWhen(f.orientationRemindAt, now)}`
        : 'Watch the orientation'
      break
    case 'TERMS_PAYMENT':
      detail = f.status === 'PAYMENT_COMPLETED' ? 'Paid · login being set up'
        : f.status === 'PAYMENT_PENDING' ? (f.paymentStatus === 'FAILED' ? 'Payment did not go through' : 'Finishing payment')
        : 'Accept the terms and create a login'
      break
    case 'JOINED':
      detail = `Joined ${relativeDay(f.joinedAt ?? f.createdAt, now)}`
      break
    case 'DONATION':
      detail = 'Sent to the giving page'
      break
    case 'NO_SHOW':
      detail = f.status === 'PAUSED' ? 'Paused after missed calls' : f.missedCallAt ? `Missed call ${callWhen(f.missedCallAt, now)}` : 'Missed the call'
      break
    case 'NOT_A_FIT':
      detail = `${signed} · closed`
      break
  }
  return { label, cls, detail }
}
