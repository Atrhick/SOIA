import { UpdateRoute } from '@/components/program-info/coach/screens'

export const dynamic = 'force-dynamic'

export default function Page({ params }: { params: { id: string } }) {
  return <UpdateRoute role="COACH" id={params.id} />
}
