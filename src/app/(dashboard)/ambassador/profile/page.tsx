import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, Link as LinkIcon } from 'lucide-react'
import { ProfileForm } from './profile-form'

export default async function AmbassadorProfilePage() {
  const session = await auth()

  if (!session || session.user.role !== 'AMBASSADOR') {
    redirect('/login')
  }

  const ambassador = await prisma.ambassador.findUnique({
    where: { userId: session.user.id },
    include: {
      user: {
        select: { email: true, createdAt: true },
      },
      coach: {
        select: { firstName: true, lastName: true },
      },
    },
  })

  if (!ambassador) {
    redirect('/login')
  }

  return (
    <div className="space-y-6">
      {/* Editable Profile Form */}
      <ProfileForm
        ambassador={{
          id: ambassador.id,
          firstName: ambassador.firstName,
          lastName: ambassador.lastName,
          email: ambassador.email || ambassador.user?.email || null,
          phone: ambassador.phone,
          region: ambassador.region,
          bio: ambassador.bio,
          photoUrl: ambassador.photoUrl,
          instagramUrl: ambassador.instagramUrl,
          facebookUrl: ambassador.facebookUrl,
          twitterUrl: ambassador.twitterUrl,
          tiktokUrl: ambassador.tiktokUrl,
          linkedinUrl: ambassador.linkedinUrl,
          youtubeUrl: ambassador.youtubeUrl,
          websiteUrl: ambassador.websiteUrl,
        }}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Coach Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-500" />
              My Coach
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                <Users className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">
                  {ambassador.coach.firstName} {ambassador.coach.lastName}
                </p>
                <p className="text-sm text-gray-500">Your assigned coach</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status */}
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-gray-500 mb-2">Account Status</p>
              <Badge
                className={
                  ambassador.status === 'APPROVED'
                    ? 'bg-green-100 text-green-700'
                    : ambassador.status === 'PENDING'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-gray-100 text-gray-700'
                }
              >
                {ambassador.status}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-2">Member Since</p>
              <p className="font-medium">
                {ambassador.user?.createdAt
                  ? new Date(ambassador.user.createdAt).toLocaleDateString()
                  : 'N/A'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* WhatsApp Group */}
        {ambassador.whatsappGroupCreated && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-green-500" />
                Support Team
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-3">
                Your WhatsApp support team has been created!
              </p>
              {ambassador.whatsappGroupLink && (
                <a
                  href={ambassador.whatsappGroupLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-green-600 hover:text-green-700"
                >
                  <LinkIcon className="w-4 h-4" />
                  Join WhatsApp Group
                </a>
              )}
            </CardContent>
          </Card>
        )}

        {/* Power Team */}
        {ambassador.powerTeamInvited && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-500" />
                Power Team
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                You have been invited to the Power Team!
              </p>
              {ambassador.powerTeamJoinedAt && (
                <p className="text-sm text-gray-500 mt-2">
                  Joined: {new Date(ambassador.powerTeamJoinedAt).toLocaleDateString()}
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
