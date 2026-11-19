import { MyProgramsRoute } from '@/components/program-info/coach/screens'

export const dynamic = 'force-dynamic'

export default function Page({ searchParams }: { searchParams?: { ask?: string | string[] } }) {
  return <MyProgramsRoute role="AMBASSADOR" searchParams={searchParams} />
}
