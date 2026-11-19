import { QuestionRoute } from '@/components/program-info/coach/screens'

export const dynamic = 'force-dynamic'

export default function Page({ params }: { params: { id: string; qid: string } }) {
  return <QuestionRoute role="AMBASSADOR" id={params.id} qid={params.qid} />
}
