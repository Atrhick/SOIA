import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { personPath } from '@/lib/people/hub'

/**
 * The program page queue only knows a page's owner by name, so its owner link points here:
 * look up who owns the page (ownership lives on the root page) and go to their person page.
 */
export default async function ProgramOwnerRedirect({ params }: { params: { programId: string } }) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') redirect('/login')

  const page = await prisma.coachProgram.findUnique({ where: { id: params.programId }, select: { id: true, parentProgramId: true } })
  if (!page) notFound()
  const root = await prisma.coachProgram.findUnique({
    where: { id: page.parentProgramId ?? page.id },
    select: { coachId: true, ambassadorId: true, coach: { select: { userId: true } }, ambassador: { select: { userId: true } } },
  })
  // At most one owner is set; a coach owner counts only without an ambassador owner (and the other way round).
  const userId = root?.coachId && !root.ambassadorId ? root.coach?.userId : root?.ambassadorId && !root.coachId ? root.ambassador?.userId : null
  if (!userId) notFound()
  redirect(personPath(userId))
}
