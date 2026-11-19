import { PreviewRoute } from '@/components/program-info/coach/screens'

export const dynamic = 'force-dynamic'

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null

export default function Page({ params, searchParams }: { params: { id: string }; searchParams?: { version?: string | string[] } }) {
  return <PreviewRoute role="AMBASSADOR" id={params.id} version={first(searchParams?.version)} />
}
