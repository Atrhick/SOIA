import { AnswersRoute } from '@/components/program-info/coach/screens'

export const dynamic = 'force-dynamic'

export default function Page({ params }: { params: { id: string; section: string } }) {
  return <AnswersRoute role="COACH" id={params.id} section={params.section} />
}
