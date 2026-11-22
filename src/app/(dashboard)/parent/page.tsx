import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Mail } from 'lucide-react'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'

/** "Tue, Nov 25, 6:00 PM" in the group's own time zone. */
function formatMeeting(d: Date, tz: string) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(d)
  } catch {
    return d.toUTCString()
  }
}

/** A parent's home: their child or children, who coaches them, their group and the next meeting. */
export default async function ParentHomePage() {
  const session = await auth()
  if (!session || session.user.role !== 'PARENT') redirect('/login')

  const now = new Date()
  const children = await prisma.ambassador.findMany({
    where: { parentUserId: session.user.id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      parentFirstName: true,
      coach: { select: { firstName: true, lastName: true } },
      groupMemberships: {
        where: { leftAt: null, group: { isActive: true } },
        select: {
          group: {
            select: {
              id: true,
              name: true,
              timezone: true,
              sessions: {
                where: { startsAt: { gte: now }, cancelled: false },
                orderBy: { startsAt: 'asc' },
                take: 1,
                select: { startsAt: true },
              },
            },
          },
        },
      },
    },
    orderBy: { firstName: 'asc' },
  })

  const parentName = children.find((c) => c.parentFirstName)?.parentFirstName

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{parentName ? `Welcome, ${parentName}` : 'Welcome'}</h1>
        <p className="mt-1 text-sm text-gray-600">
          Here you can see how your child is connected in the program: who their coach is, which group they meet with, and when
          they meet next.
        </p>
      </div>

      {children.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-5 text-sm text-gray-700">
          We have not linked a child to your account yet. If you think this is a mistake, please reply to your child&apos;s coach
          and they will sort it out.
        </div>
      ) : (
        <ul className="space-y-4">
          {children.map((child) => {
            const coachName = child.coach ? `${child.coach.firstName} ${child.coach.lastName}`.trim() : null
            return (
              <li key={child.id} className="rounded-lg border border-gray-200 bg-white p-5">
                <h2 className="break-words text-lg font-semibold text-gray-900">
                  {child.firstName} {child.lastName}
                </h2>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex flex-wrap gap-x-2">
                    <dt className="text-gray-500">Coach:</dt>
                    <dd className="break-words text-gray-900">{coachName || 'Not assigned yet'}</dd>
                  </div>
                  {child.groupMemberships.length === 0 ? (
                    <div className="flex flex-wrap gap-x-2">
                      <dt className="text-gray-500">Group:</dt>
                      <dd className="text-gray-900">Not in a group yet</dd>
                    </div>
                  ) : (
                    child.groupMemberships.map(({ group }) => {
                      const next = group.sessions[0]
                      return (
                        <div key={group.id} className="space-y-1">
                          <div className="flex flex-wrap gap-x-2">
                            <dt className="text-gray-500">Group:</dt>
                            <dd className="break-words text-gray-900">{group.name}</dd>
                          </div>
                          <div className="flex flex-wrap gap-x-2">
                            <dt className="text-gray-500">Next meeting:</dt>
                            <dd className="text-gray-900">
                              {next ? formatMeeting(next.startsAt, group.timezone) : 'No meeting booked yet'}
                            </dd>
                          </div>
                        </div>
                      )
                    })
                  )}
                </dl>
              </li>
            )
          })}
        </ul>
      )}

      <Link
        href="/parent/messages"
        className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
      >
        <Mail className="h-4 w-4" />
        Open your messages
      </Link>
    </div>
  )
}
