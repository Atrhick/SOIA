import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calendarEvents } from '@/lib/calendar-events'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: { calendarId: string } }
) {
  const calendarId = params.calendarId
  const session = await auth()

  const calendar = await prisma.adminCalendar.findUnique({
    where: { id: calendarId },
    select: {
      isActive: true,
      visibility: true,
      isPublicBookable: true,
      access: session
        ? { where: { userId: session.user.id }, select: { id: true } }
        : { where: { userId: '' }, select: { id: true } },
    },
  })

  if (!calendar || !calendar.isActive) {
    return new Response('Not found', { status: 404 })
  }

  // Public booking pages (/book/[slug], /book/orientation/[token],
  // /book/biz-dev-interview/[token]) subscribe to this stream with no session
  // to keep availability live while someone is choosing a slot. Those
  // calendars are public by design, so they stay open to everyone.
  const isPubliclyBookable =
    calendar.visibility === 'PUBLIC' || calendar.isPublicBookable

  if (!isPubliclyBookable) {
    // Internal calendar. Being logged in is not enough - without a role check
    // any account, including the associate roles which have no calendar access
    // at all, could stream a staff calendar's live mutations knowing only its id.
    if (!session) {
      return new Response('Unauthorized', { status: 401 })
    }

    const role = session.user.role
    const mayView =
      role === 'ADMIN' ||
      calendar.access.length > 0 ||
      (calendar.visibility === 'GLOBAL' && (role === 'COACH' || role === 'AMBASSADOR')) ||
      (calendar.visibility === 'COACHES_ONLY' && role === 'COACH') ||
      (calendar.visibility === 'AMBASSADORS_ONLY' && role === 'AMBASSADOR')

    if (!mayView) {
      return new Response('Forbidden', { status: 403 })
    }
  }

  // Create a new readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()

      // Send initial connection message
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected', calendarId })}\n\n`))

      // Subscribe to calendar events
      const unsubscribe = calendarEvents.subscribe(calendarId, (data) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {
          // Connection closed
        }
      })

      // Send heartbeat every 30 seconds to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`))
        } catch {
          clearInterval(heartbeat)
        }
      }, 30000)

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat)
        unsubscribe()
        try {
          controller.close()
        } catch {
          // Already closed
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
