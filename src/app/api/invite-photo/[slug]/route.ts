/**
 * Public invite photo: GET /api/invite-photo/[slug] -> the inviter's square JPEG, or 404.
 * Only active coaches/ambassadors who can invite (inviterBySlug). The stored data URL is re-validated
 * and the decoded bytes must start with the JPEG magic number, so nothing but a JPEG is ever served.
 */
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { inviterBySlug } from '@/lib/get-involved/server'
import { jpegDataUrlPayload } from '@/components/get-involved/invite-profile/photo-rules'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const notFound = () => new NextResponse('Not found', { status: 404, headers: { 'Cache-Control': 'public, max-age=60', 'X-Content-Type-Options': 'nosniff' } })

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const slug = typeof params.slug === 'string' ? params.slug : ''
  if (!slug || slug.length > 120) return notFound()

  const who = await inviterBySlug(slug)
  if (!who) return notFound()
  const u = await prisma.user.findUnique({ where: { id: who.id }, select: { invitePhoto: true } })
  const b64 = jpegDataUrlPayload(u?.invitePhoto)
  if (!b64) return notFound()

  const bytes = Buffer.from(b64, 'base64')
  if (bytes.length < 3 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return notFound()

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      'Content-Type': 'image/jpeg',
      'Content-Length': String(bytes.length),
      'Cache-Control': 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline',
    },
  })
}
