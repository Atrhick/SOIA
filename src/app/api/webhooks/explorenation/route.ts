/**
 * ExploreNation webhook: POST {APP_URL}/api/webhooks/explorenation when a founding-rate code is entered
 * (held), used, or expires. Signed with EN_API_SECRET like our calls to them (src/lib/explorenation/core.ts):
 * bare 401 on a bad or stale signature. Matches the code by `code`, else `requestId`. Repeats and
 * out-of-order events are harmless (canMove). 200 for every signed event, even ones we ignore.
 */
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { canMove, parseWebhook, verifySignature, WEBHOOK_PATH, type CodeStatus } from '@/lib/explorenation/core'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BODY = 32 * 1024

export async function POST(req: Request) {
  const secret = process.env.EN_API_SECRET?.trim()
  if (!secret) return NextResponse.json({ error: 'not_configured' }, { status: 503 })
  const rawBody = await req.text()
  if (rawBody.length > MAX_BODY) return NextResponse.json({ error: 'too_large' }, { status: 413 })
  const ok = verifySignature(secret, req.headers.get('x-nt-timestamp'), req.headers.get('x-nt-signature'), 'POST', WEBHOOK_PATH, rawBody, Math.floor(Date.now() / 1000))
  if (!ok) return new NextResponse(null, { status: 401 })

  const ev = parseWebhook(rawBody)
  if (!ev) return NextResponse.json({ error: 'bad_request', message: 'Missing code, requestId or status.' }, { status: 400 })

  try {
    const row = await prisma.partnerCode.findFirst({
      where: { partner: 'explorenation', OR: [...(ev.code ? [{ code: ev.code }] : []), ...(ev.requestId ? [{ requestId: ev.requestId }] : [])] },
      select: { id: true, status: true, prospectId: true },
    })
    if (!row) return NextResponse.json({ outcome: 'unknown_code' })
    if (!canMove(row.status as CodeStatus, ev.status)) return NextResponse.json({ outcome: 'ignored' })
    const moved = await prisma.partnerCode.updateMany({
      where: { id: row.id, status: row.status },
      data: { status: ev.status, statusAt: ev.at, ...(ev.package ? { package: ev.package } : {}) },
    })
    if (moved.count === 1) {
      await prisma.auditLog.create({
        data: { userId: null, action: 'PARTNER_CODE_STATUS', entityType: 'Prospect', entityId: row.prospectId, details: JSON.stringify({ partnerCodeId: row.id, from: row.status, to: ev.status, package: ev.package }) },
      }).catch(() => {})
      try { revalidatePath('/admin/discovery-calls/[id]', 'page'); revalidatePath('/coach/discovery-calls/[id]', 'page') } catch { /* not fatal */ }
    }
    return NextResponse.json({ outcome: moved.count === 1 ? 'updated' : 'ignored' })
  } catch (e) {
    console.error('[EN webhook] failed', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
