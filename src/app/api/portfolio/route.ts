import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { handInPortfolio } from '@/lib/groups/portfolio-server'
import { PORTFOLIO_MAX_BYTES } from '@/lib/groups/portfolio-file'

export const runtime = 'nodejs'

/** Ambassador hands in (or edits) a portfolio piece. multipart/form-data: id?, weekNo, title, body?, file? */
export async function POST(req: Request) {
  const session = await auth()
  if (!session || session.user.role !== 'AMBASSADOR') {
    return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
  }
  if (session.user.isImpersonating) {
    return NextResponse.json({ error: "You're viewing as this ambassador, so you can't hand in work for them." }, { status: 403 })
  }
  const ambassador = await prisma.ambassador.findUnique({ where: { userId: session.user.id }, select: { id: true } })
  if (!ambassador) return NextResponse.json({ error: "We couldn't find your ambassador profile." }, { status: 404 })

  const len = Number(req.headers.get('content-length') || 0)
  if (len > PORTFOLIO_MAX_BYTES + 1024 * 1024) {
    return NextResponse.json({ error: 'That file is bigger than 10 MB. Please pick a smaller one.' }, { status: 413 })
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: "We couldn't read that. Please try again." }, { status: 400 })
  }

  const f = form.get('file')
  let file: { name: string; data: Buffer } | null = null
  if (f && typeof f !== 'string' && f.size > 0) {
    if (f.size > PORTFOLIO_MAX_BYTES) {
      return NextResponse.json({ error: 'That file is bigger than 10 MB. Please pick a smaller one.' }, { status: 413 })
    }
    file = { name: f.name, data: Buffer.from(await f.arrayBuffer()) }
  }

  try {
    const result = await handInPortfolio(
      ambassador.id,
      {
        id: (form.get('id') as string) || undefined,
        weekNo: form.get('weekNo'),
        title: form.get('title'),
        body: form.get('body'),
      },
      file,
    )
    if ('error' in result) return NextResponse.json(result, { status: 400 })
    revalidatePath('/ambassador/portfolio')
    revalidatePath('/coach/portfolio')
    return NextResponse.json(result)
  } catch (e) {
    console.error('Portfolio hand-in failed', e)
    return NextResponse.json({ error: 'Something went wrong saving your piece. Please try again.' }, { status: 500 })
  }
}
