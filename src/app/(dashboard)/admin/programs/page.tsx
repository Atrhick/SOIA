import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  getAllPrograms,
  getCoreQuestions,
  getProgramQuestionSettings,
} from '@/lib/actions/program-pages'
import { ProgramsAdminClient } from './programs-admin-client'

export default async function AdminProgramsPage() {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    redirect('/login')
  }

  const [result, questionsResult, settingsResult, inFlow, children] = await Promise.all([
    getAllPrograms(),
    getCoreQuestions(),
    getProgramQuestionSettings(),
    // A13: programs in the new program-info flow (same rule as isInProgramInfoFlow) go live only from
    // the page queue, after the owner checks them.
    prisma.coachProgram.findMany({
      where: { OR: [{ parentProgramId: { not: null } }, { groupsConfirmedAt: { not: null } }, { pageVersions: { some: {} } }] },
      select: { id: true },
    }),
    // Group pages (child rows) are pages of their root program, not separate grant programs.
    prisma.coachProgram.findMany({ where: { parentProgramId: { not: null } }, select: { id: true, parentProgramId: true } }),
  ])
  const childIds = new Set(children.map((c) => c.id))
  const groupPageCounts: Record<string, number> = {}
  for (const c of children) if (c.parentProgramId) groupPageCounts[c.parentProgramId] = (groupPageCounts[c.parentProgramId] ?? 0) + 1

  if ('error' in result) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        {result.error}
      </div>
    )
  }

  return (
    <ProgramsAdminClient
      programs={result.programs.filter((p) => !childIds.has(p.id))}
      groupPageCounts={groupPageCounts}
      inFlowIds={inFlow.map((p) => p.id)}
      coaches={result.coaches}
      ambassadors={result.ambassadors}
      coreQuestions={'error' in questionsResult ? [] : questionsResult.questions}
      standardQuestionsEnabled={
        'error' in settingsResult ? false : settingsResult.settings.standardQuestionsEnabled
      }
    />
  )
}
