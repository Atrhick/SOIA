import { LiveRoute } from '@/components/program-info/coach/screens'

export const dynamic = 'force-dynamic'

export default function Page({ params }: { params: { id: string } }) {
  return <LiveRoute role="COACH" id={params.id} />
}
