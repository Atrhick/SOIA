import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function makeClient() {
  const client = new PrismaClient()
  // Every bell notification also goes to the person's phone/browser if they turned
  // notifications on (src/lib/push.ts). Never blocks or fails the original write.
  client.$use(async (params, next) => {
    const result = await next(params)
    if (params.model === 'AdminNotification' && (params.action === 'create' || params.action === 'createMany')) {
      const raw = params.args?.data
      const rows: { userId?: string; title?: string; message?: string; actionUrl?: string | null; type?: string }[] = Array.isArray(raw) ? raw : raw ? [raw] : []
      const work = import('./push').then(({ sendPushToUser }) =>
        Promise.allSettled(rows.filter((r) => r.userId && r.title).map((r) =>
          sendPushToUser(r.userId as string, { title: r.title as string, body: r.message ?? '', url: r.actionUrl || '/', tag: r.type }),
        )),
      ).catch(() => {})
      // Inside a transaction don't hold it open on network calls.
      if (!params.runInTransaction) await work
    }
    return result
  })
  return client
}

export const prisma = globalForPrisma.prisma ?? makeClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
