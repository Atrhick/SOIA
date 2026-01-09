import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getSurveysForRole } from '@/lib/actions/surveys'
import { SurveysListClient } from '../../coach/surveys/surveys-list-client'

export default async function AmbassadorSurveysPage() {
  const session = await auth()

  if (!session || session.user.role !== 'AMBASSADOR') {
    redirect('/login')
  }

  const { surveys, error } = await getSurveysForRole('AMBASSADOR')

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">{error}</p>
      </div>
    )
  }

  return <SurveysListClient surveys={surveys} userRole="AMBASSADOR" />
}
