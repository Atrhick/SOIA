import { SetupRoute } from '@/components/program-info/coach/screens'

export const dynamic = 'force-dynamic'

export default function Page({ params }: { params: { id: string } }) {
  return <SetupRoute role="AMBASSADOR" id={params.id} />
}
