/** .ics file with every meeting of a group (one VEVENT each, UTC times). Pure. */
import { icsEscape } from '@/lib/get-involved/call-tools'

function stamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function fold(line: string): string {
  if (line.length <= 74) return line
  const parts: string[] = []
  for (let i = 0; i < line.length; i += 73) parts.push((i ? ' ' : '') + line.slice(i, i + 73))
  return parts.join('\r\n')
}

export interface IcsMeeting {
  id: string
  weekNo: number | null
  startsAt: Date
  endsAt: Date
  cancelled: boolean
}

export function buildGroupIcs(g: {
  name: string
  meetingLink?: string | null
  location?: string | null
  meetings: IcsMeeting[]
  now?: Date
}): string {
  const now = g.now ?? new Date()
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//NowTRANSFORMED//Group meetings//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(g.name)}`,
  ]
  const where = g.location || g.meetingLink || ''
  for (const m of g.meetings) {
    const desc = ['Your weekly NowTRANSFORMED group meeting.', g.meetingLink ? `Join here: ${g.meetingLink}` : '']
      .filter(Boolean)
      .join('\n')
    lines.push(
      'BEGIN:VEVENT',
      `UID:group-session-${icsEscape(m.id)}@nowtransformed`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(m.startsAt)}`,
      `DTEND:${stamp(m.endsAt)}`,
      `SUMMARY:${icsEscape(m.weekNo ? `${g.name}: week ${m.weekNo}` : g.name)}`,
      `DESCRIPTION:${icsEscape(desc)}`,
      ...(where ? [`LOCATION:${icsEscape(where)}`] : []),
      ...(g.meetingLink ? [`URL:${icsEscape(g.meetingLink)}`] : []),
      `STATUS:${m.cancelled ? 'CANCELLED' : 'CONFIRMED'}`,
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}
