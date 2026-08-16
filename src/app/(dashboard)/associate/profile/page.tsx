import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getMyAssociateProfile } from '@/lib/actions/associates'
import { isAssociateRole } from '@/lib/roles'
import { Card, CardContent } from '@/components/ui/card'
import { AssociateProfileClient } from './associate-profile-client'

export default async function AssociateProfilePage() {
  const session = await auth()
  if (!session || !isAssociateRole(session.user.role)) {
    redirect('/login')
  }

  const result = await getMyAssociateProfile()
  if ('error' in result) {
    return (
      <Card>
        <CardContent className="pt-6">
          <h1 className="text-xl font-semibold text-gray-900">Your profile is not set up</h1>
          <p className="text-gray-600 mt-2">
            Please contact your administrator so they can finish setting up your account.
          </p>
        </CardContent>
      </Card>
    )
  }

  return <AssociateProfileClient profile={result.profile} />
}
