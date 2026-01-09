import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getSurveysForRole } from '@/lib/actions/surveys'
import { SurveysListClient } from './surveys-list-client'

export default async function CoachSurveysPage() {
  const session = await auth()

  if (!session || session.user.role !== 'COACH') {
    redirect('/login')
  }

  const { surveys, error } = await getSurveysForRole('COACH')

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">{error}</p>
      </div>
    )
  }

  return <SurveysListClient surveys={surveys} userRole="COACH" />
}
