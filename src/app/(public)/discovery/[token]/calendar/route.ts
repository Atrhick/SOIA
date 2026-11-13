/**
 * GET /discovery/[token]/calendar: the prospect's booked discovery call as an .ics file ("Add to calendar").
 * Same token rules as the booking page; unknown, expired or no-call tokens all get the same 404.
 */
import { NextRequest, NextResponse } from 'next/server'
import { journeyOpen } from '@/lib/get-involved/core'
import { journeyUrl, prospectByJourneyToken, rateLimited } from '@/lib/get-involved/server'
import { buildIcs } from '@/lib/get-involved/call-tools'

export const dynamic = 'force-dynamic'

function notFound() {
  return new NextResponse('No booked call found for this link.', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } })
}

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',').map((s) => s.trim()).filter(Boolean).pop() || 'unknown'
  if (rateLimited(`ics:${ip}`, 30, 10 * 60_000)) return new NextResponse('Too many requests', { status: 429 })
  const p = await prospectByJourneyToken(String(params.token ?? ''))
  const call = p?.discoveryCalls[0]
  const now = new Date()
  // A booked upcoming call keeps the link working (same rule as journeyUsable).
  if (!p || !call || !journeyOpen(p.status) || call.endsAt <= now || !p.journeyToken) return notFound()
  const host = call.host?.discoveryHost?.displayName ?? 'the NowTransformed team'
  const meetingUrl = call.meetingUrl ?? call.host?.discoveryHost?.meetingUrl ?? null
  const ics = buildIcs({
    uid: `discovery-${call.id}@nowtransformed`,
    startsAt: call.startsAt,
    endsAt: call.endsAt,
    title: `NowTransformed discovery call with ${host}`,
    description: [
      `Your free ${Math.round((call.endsAt.getTime() - call.startsAt.getTime()) / 60_000)}-minute discovery call with ${host}.`,
      meetingUrl ? `Join: ${meetingUrl}` : null,
      p.ageRange === 'UNDER_18' ? 'A parent or guardian must be on this call.' : null,
      `Change or cancel (up to 2 hours before): ${journeyUrl(p.journeyToken)}`,
    ].filter(Boolean).join('\n'),
    url: meetingUrl,
    now,
  })
  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="discovery-call.ics"',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
    },
  })
}
