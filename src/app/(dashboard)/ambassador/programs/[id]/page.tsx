import { AnswersRoute } from '@/components/program-info/coach/screens'

export const dynamic = 'force-dynamic'

export default function Page({ params }: { params: { id: string } }) {
  return <AnswersRoute role="AMBASSADOR" id={params.id} />
}
