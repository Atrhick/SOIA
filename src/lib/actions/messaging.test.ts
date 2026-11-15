import { describe, it, expect, vi, beforeEach } from 'vitest'
import { replyToThread, markMessagesAsRead } from './messaging'

const { session, db } = vi.hoisted(() => ({
  session: { user: { id: 'u1', role: 'COACH' } },
  db: {
    messageThread: { findFirst: vi.fn(), update: vi.fn() },
    message: { create: vi.fn(), updateMany: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({ auth: vi.fn(async () => session) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ default: db }))

const form = (content: string) => { const f = new FormData(); f.set('content', content); return f }

beforeEach(() => {
  vi.clearAllMocks()
  db.messageThread.findFirst.mockResolvedValue({ id: 't1' })
})

describe('support thread access', () => {
  it('an admin may reply to any thread, and joins it by replying', async () => {
    session.user = { id: 'a1', role: 'ADMIN' }
    expect(await replyToThread('t1', form('On it'))).toEqual({ success: true })
    expect(db.messageThread.findFirst).toHaveBeenCalledWith({ where: { id: 't1' } })
    expect(db.messageThread.update.mock.calls[0][0].data.participants).toEqual({ connect: { id: 'a1' } })
  })

  it('anyone else may only reply to threads they belong to, and does not get added', async () => {
    session.user = { id: 'u1', role: 'COACH' }
    await replyToThread('t1', form('Thanks'))
    expect(db.messageThread.findFirst).toHaveBeenCalledWith({ where: { id: 't1', participants: { some: { id: 'u1' } } } })
    expect(db.messageThread.update.mock.calls[0][0].data.participants).toBeUndefined()
  })

  it('marking read is refused for a thread the person cannot open', async () => {
    session.user = { id: 'u2', role: 'AMBASSADOR' }
    db.messageThread.findFirst.mockResolvedValue(null)
    expect(await markMessagesAsRead('t1')).toEqual({ error: 'Thread not found or access denied' })
    expect(db.message.updateMany).not.toHaveBeenCalled()
  })

  it('marking read works for a thread the person belongs to', async () => {
    session.user = { id: 'u1', role: 'COACH' }
    expect(await markMessagesAsRead('t1')).toEqual({ success: true })
    expect(db.message.updateMany).toHaveBeenCalledOnce()
  })
})
