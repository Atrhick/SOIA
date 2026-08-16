import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getMyAssociateProfile } from '@/lib/actions/associates'
import { isAssociateRole, ASSOCIATE_LABELS, type AssociateRole } from '@/lib/roles'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertBanner } from '@/components/ui/alert-banner'

export default async function AssociateDashboardPage() {
  const session = await auth()
  if (!session || !isAssociateRole(session.user.role)) {
    redirect('/login')
  }

  const result = await getMyAssociateProfile()

  // A role-bearing user with no profile row would otherwise hit a blank page.
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

  const p = result.profile
  const roleLabel = ASSOCIATE_LABELS[p.type as AssociateRole] ?? p.type

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-semibold text-gray-900">
            Welcome, {p.firstName}
          </h1>
          <Badge variant="info">{roleLabel}</Badge>
          {p.status === 'INACTIVE' && <Badge variant="destructive">Inactive</Badge>}
        </div>
        <p className="text-gray-500 mt-1">
          Your association with NowTransformed.
        </p>
      </div>

      <AlertBanner
        variant="info"
        message="Still using the temporary password an administrator gave you? Change it from My Profile."
      />

      <Card>
        <CardContent className="pt-6">
          <h2 className="font-semibold text-gray-900 mb-4">Your details</h2>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Detail label="Name" value={`${p.firstName} ${p.lastName}`} />
            <Detail label="Email" value={p.email} />
            <Detail label="Association" value={roleLabel} />
            <Detail label="Phone" value={p.phone} />
            <Detail label="Organization" value={p.organization} />
            <Detail label="Registered by" value={p.coachName} />
          </dl>
          {p.serviceOffered && (
            <div className="mt-4">
              <dt className="text-xs uppercase tracking-wide text-gray-500">What you provide</dt>
              <dd className="text-gray-800 whitespace-pre-wrap mt-1">{p.serviceOffered}</dd>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h2 className="font-semibold text-gray-900">Your account</h2>
          <p className="text-gray-600 mt-1 mb-4">
            Update your contact details or change your password.
          </p>
          <Link
            href="/associate/profile"
            className="inline-flex items-center justify-center rounded-md bg-primary-600 px-3 py-2 text-sm font-medium text-white shadow transition-colors hover:bg-primary-700"
          >
            Go to My Profile
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="text-gray-800 mt-0.5">
        {value?.trim() ? value : <span className="text-gray-400">Not provided</span>}
      </dd>
    </div>
  )
}
