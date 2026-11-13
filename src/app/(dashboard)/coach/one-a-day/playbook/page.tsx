import { PlaybookPage } from '@/components/get-involved/playbook/playbook-page'

export const dynamic = 'force-dynamic'

export default function Page({ searchParams }: { searchParams: { program?: string } }) {
  return <PlaybookPage role="COACH" programParam={typeof searchParams.program === 'string' ? searchParams.program : undefined} />
}
