import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getOutreachSettings, listOfferPrograms, nextMonthStart } from '@/lib/get-involved/offer'
import { OutreachSettingsClient } from './outreach-settings-client'

export const dynamic = 'force-dynamic'

export default async function OutreachSettingsPage() {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') redirect('/login')
  const [programs, site] = await Promise.all([listOfferPrograms(), getOutreachSettings()])
  return <OutreachSettingsClient programs={programs} site={site} resetsOn={nextMonthStart().toISOString()} />
}
