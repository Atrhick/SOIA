'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { buildWeeklySchedule, isValidTimeZone, parseHHMM } from '@/lib/groups/schedule'

type Result<T = object> = ({ success: true } & T) | { error: string }

const groupSchema = z.object({
  name: z.string().trim().min(1, 'Give the group a name').max(100),
  meetingWeekday: z.coerce.number().int().min(0).max(6),
  meetingTime: z.string().refine((s) => parseHHMM(s) !== null, 'Time must look like 18:00'),
  timezone: z.string().refine(isValidTimeZone, 'Pick a real time zone'),
  durationMin: z.coerce.number().int().min(15).max(240).default(60),
  meetingLink: z.string().trim().url('That meeting link does not look right').max(500).optional().or(z.literal('')),
  location: z.string().trim().max(200).optional().or(z.literal('')),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a start date'),
  weeks: z.coerce.number().int().min(1).max(52).default(8),
})

export type GroupInput = z.input<typeof groupSchema>

function isAdmin(role: string) {
  return role === 'ADMIN' || role === 'SUB_ADMIN'
}

/** Signed-in user who may manage this coach's groups, and the CoachProfile they act for. */
async function getActor(coachIdForAdmin?: string) {
  const session = await auth()
  if (!session?.user) return { error: 'Please sign in again.' }
  const role = session.user.role as string
  if (role === 'COACH') {
    const coach = await prisma.coachProfile.findUnique({ where: { userId: session.user.id }, select: { id: true, userId: true } })
    if (!coach) return { error: 'We could not find your coach profile.' }
    return { session, coachId: coach.id, coachUserId: coach.userId }
  }
  if (isAdmin(role)) {
    if (!coachIdForAdmin) return { error: 'Choose a coach first.' }
    const coach = await prisma.coachProfile.findUnique({ where: { id: coachIdForAdmin }, select: { id: true, userId: true } })
    if (!coach) return { error: 'Coach not found.' }
    return { session, coachId: coach.id, coachUserId: coach.userId }
  }
  return { error: 'You do not have access to groups.' }
}

/** Loads a group and checks the signed-in user may manage it (its coach, or an admin). */
async function getManagedGroup(groupId: string) {
  const session = await auth()
  if (!session?.user) return { error: 'Please sign in again.' }
  const group = await prisma.ambassadorGroup.findUnique({
    where: { id: groupId },
    include: { coach: { select: { id: true, userId: true } } },
  })
  if (!group) return { error: 'Group not found.' }
  const role = session.user.role as string
  if (!isAdmin(role) && !(role === 'COACH' && group.coach.userId === session.user.id)) {
    return { error: 'You do not have access to this group.' }
  }
  return { session, group }
}

function ageOn(dob: Date | null, at: Date): number | null {
  if (!dob) return null
  let age = at.getUTCFullYear() - dob.getUTCFullYear()
  const m = at.getUTCMonth() - dob.getUTCMonth()
  if (m < 0 || (m === 0 && at.getUTCDate() < dob.getUTCDate())) age--
  return age
}

type AmbLite = { id: string; userId: string | null; parentUserId: string | null; dateOfBirth: Date | null }

/** User ids who belong in the group chat: coach + ambassadors + parents of under-18s. */
function chatUserIds(coachUserId: string, ambassadors: AmbLite[]): string[] {
  const ids = new Set<string>([coachUserId])
  const now = new Date()
  for (const a of ambassadors) {
    if (a.userId) ids.add(a.userId)
    const age = ageOn(a.dateOfBirth, now)
    if (a.parentUserId && age !== null && age < 18) ids.add(a.parentUserId)
  }
  return Array.from(ids)
}

/** Ambassador user ids who get the calendar invites. */
function calendarUserIds(ambassadors: AmbLite[]): string[] {
  return ambassadors.map((a) => a.userId).filter((x): x is string => !!x)
}

const ambSelect = { id: true, userId: true, parentUserId: true, dateOfBirth: true } as const

function revalidateGroups(groupId?: string) {
  revalidatePath('/coach/groups')
  if (groupId) revalidatePath(`/coach/groups/${groupId}`)
}

function cleanForm(input: GroupInput): { error: string } | { data: z.output<typeof groupSchema> } {
  const parsed = groupSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Please check the form.' }
  return { data: parsed.data }
}

export async function createGroup(
  input: GroupInput & { ambassadorIds?: string[]; coachId?: string },
): Promise<Result<{ groupId: string }>> {
  const actor = await getActor(input.coachId)
  if ('error' in actor) return { error: actor.error ?? 'Something went wrong.' }
  const cleaned = cleanForm(input)
  if ('error' in cleaned) return { error: cleaned.error }
  const d = cleaned.data

  const ambassadorIds = Array.from(new Set(input.ambassadorIds || []))
  const ambassadors = ambassadorIds.length
    ? await prisma.ambassador.findMany({ where: { id: { in: ambassadorIds }, coachId: actor.coachId }, select: ambSelect })
    : []
  if (ambassadors.length !== ambassadorIds.length) return { error: 'You can only add your own ambassadors.' }

  let schedule
  try {
    schedule = buildWeeklySchedule({
      startDate: d.startDate,
      weekday: d.meetingWeekday,
      time: d.meetingTime,
      timezone: d.timezone,
      durationMin: d.durationMin,
      weeks: d.weeks,
    })
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not work out the meeting dates.' }
  }

  try {
    const groupId = await prisma.$transaction(
      async (tx) => {
        const channel = await tx.collaborationChannel.create({
          data: {
            type: 'CHANNEL',
            name: d.name,
            description: 'Group chat for your weekly NowTRANSFORMED group',
            isPrivate: true,
            createdById: actor.session.user.id,
            allowedRoles: [],
            defaultMeetingLink: d.meetingLink || null,
            members: { create: chatUserIds(actor.coachUserId, ambassadors).map((userId) => ({ userId })) },
          },
        })
        const group = await tx.ambassadorGroup.create({
          data: {
            coachId: actor.coachId,
            name: d.name,
            meetingWeekday: d.meetingWeekday,
            meetingTime: d.meetingTime,
            timezone: d.timezone,
            durationMin: d.durationMin,
            meetingLink: d.meetingLink || null,
            location: d.location || null,
            startDate: new Date(`${d.startDate}T12:00:00.000Z`),
            weeks: d.weeks,
            channelId: channel.id,
            members: { create: ambassadors.map((a) => ({ ambassadorId: a.id })) },
          },
        })
        const attendees = calendarUserIds(ambassadors)
        const seriesId = `group-${group.id}`
        for (const m of schedule) {
          const ev = await tx.calendarEvent.create({
            data: {
              creatorId: actor.coachUserId,
              title: `${d.name}: week ${m.weekNo} meeting`,
              description: 'Your weekly NowTRANSFORMED group meeting.',
              type: 'MEETING',
              startTime: m.startsAt,
              endTime: m.endsAt,
              timezone: d.timezone,
              location: d.location || null,
              isOnline: !!d.meetingLink,
              meetingLink: d.meetingLink || null,
              seriesId,
              attendees: { create: attendees.map((userId) => ({ userId })) },
            },
          })
          await tx.groupSession.create({
            data: { groupId: group.id, weekNo: m.weekNo, startsAt: m.startsAt, endsAt: m.endsAt, calendarEventId: ev.id },
          })
        }
        return group.id
      },
      { timeout: 30000 },
    )
    revalidateGroups(groupId)
    return { success: true, groupId }
  } catch (error) {
    console.error('createGroup failed:', error)
    return { error: 'Could not create the group. Please try again.' }
  }
}

/**
 * Edit the group. Name, link, location and length also update upcoming meetings and their
 * calendar events. A new day/time is saved on the group but does not move meetings already made.
 */
export async function updateGroup(groupId: string, input: GroupInput): Promise<Result> {
  const g = await getManagedGroup(groupId)
  if ('error' in g) return { error: g.error ?? 'Something went wrong.' }
  const cleaned = cleanForm(input)
  if ('error' in cleaned) return { error: cleaned.error }
  const d = cleaned.data
  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.ambassadorGroup.update({
          where: { id: groupId },
          data: {
            name: d.name,
            meetingWeekday: d.meetingWeekday,
            meetingTime: d.meetingTime,
            timezone: d.timezone,
            durationMin: d.durationMin,
            meetingLink: d.meetingLink || null,
            location: d.location || null,
          },
        })
        if (g.group.channelId) {
          await tx.collaborationChannel.update({
            where: { id: g.group.channelId },
            data: { name: d.name, defaultMeetingLink: d.meetingLink || null },
          })
        }
        const upcoming = await tx.groupSession.findMany({ where: { groupId, startsAt: { gte: new Date() } } })
        for (const s of upcoming) {
          const endsAt = new Date(s.startsAt.getTime() + d.durationMin * 60000)
          await tx.groupSession.update({ where: { id: s.id }, data: { endsAt } })
          if (s.calendarEventId) {
            await tx.calendarEvent.updateMany({
              where: { id: s.calendarEventId },
              data: {
                title: s.weekNo ? `${d.name}: week ${s.weekNo} meeting` : `${d.name} meeting`,
                endTime: endsAt,
                location: d.location || null,
                isOnline: !!d.meetingLink,
                meetingLink: d.meetingLink || null,
              },
            })
          }
        }
      },
      { timeout: 30000 },
    )
    revalidateGroups(groupId)
    return { success: true }
  } catch (error) {
    console.error('updateGroup failed:', error)
    return { error: 'Could not save the changes. Please try again.' }
  }
}

export async function archiveGroup(groupId: string, archived = true): Promise<Result> {
  const g = await getManagedGroup(groupId)
  if ('error' in g) return { error: g.error ?? 'Something went wrong.' }
  if (g.session.user.isImpersonating) return { error: 'You cannot archive a group while viewing as someone else.' }
  await prisma.ambassadorGroup.update({ where: { id: groupId }, data: { isActive: !archived } })
  revalidateGroups(groupId)
  return { success: true }
}

/** Bring the chat and upcoming calendar invites in line with the current members. */
async function syncMembership(groupId: string) {
  const group = await prisma.ambassadorGroup.findUniqueOrThrow({
    where: { id: groupId },
    include: {
      coach: { select: { userId: true } },
      members: { include: { ambassador: { select: ambSelect } } },
      sessions: { where: { startsAt: { gte: new Date() } }, select: { calendarEventId: true } },
    },
  })
  const active = group.members.filter((m) => !m.leftAt).map((m) => m.ambassador)
  const want = new Set(chatUserIds(group.coach.userId, active))
  const wantCal = new Set(calendarUserIds(active))
  // Seats we manage: anyone who has ever been a member (or their parent). Never the coach.
  const managed = new Set(chatUserIds(group.coach.userId, group.members.map((m) => m.ambassador)))
  managed.delete(group.coach.userId)

  await prisma.$transaction(
    async (tx) => {
      if (group.channelId) {
        const channelId = group.channelId
        const removeIds = Array.from(managed).filter((u) => !want.has(u))
        if (removeIds.length) await tx.channelMember.deleteMany({ where: { channelId, userId: { in: removeIds } } })
        await tx.channelMember.createMany({
          data: Array.from(want).map((userId) => ({ channelId, userId })),
          skipDuplicates: true,
        })
      }
      const eventIds = group.sessions.map((s) => s.calendarEventId).filter((x): x is string => !!x)
      if (eventIds.length) {
        const removeCal = Array.from(managed).filter((u) => !wantCal.has(u))
        if (removeCal.length) {
          await tx.eventAttendee.deleteMany({ where: { eventId: { in: eventIds }, userId: { in: removeCal } } })
        }
        const rows = eventIds.flatMap((eventId) => Array.from(wantCal).map((userId) => ({ eventId, userId })))
        if (rows.length) await tx.eventAttendee.createMany({ data: rows, skipDuplicates: true })
      }
    },
    { timeout: 30000 },
  )
}

export async function addGroupMembers(groupId: string, ambassadorIds: string[]): Promise<Result> {
  const g = await getManagedGroup(groupId)
  if ('error' in g) return { error: g.error ?? 'Something went wrong.' }
  const ids = z.array(z.string().min(1)).min(1, 'Pick at least one ambassador').safeParse(ambassadorIds)
  if (!ids.success) return { error: ids.error.issues[0]?.message || 'Pick at least one ambassador' }
  const unique = Array.from(new Set(ids.data))
  const found = await prisma.ambassador.findMany({ where: { id: { in: unique }, coachId: g.group.coachId }, select: { id: true } })
  if (found.length !== unique.length) return { error: 'You can only add your own ambassadors.' }
  try {
    for (const a of found) {
      await prisma.ambassadorGroupMember.upsert({
        where: { groupId_ambassadorId: { groupId, ambassadorId: a.id } },
        create: { groupId, ambassadorId: a.id },
        update: { leftAt: null },
      })
    }
    await syncMembership(groupId)
    revalidateGroups(groupId)
    return { success: true }
  } catch (error) {
    console.error('addGroupMembers failed:', error)
    return { error: 'Could not add them. Please try again.' }
  }
}

export async function removeGroupMember(groupId: string, ambassadorId: string): Promise<Result> {
  const g = await getManagedGroup(groupId)
  if ('error' in g) return { error: g.error ?? 'Something went wrong.' }
  if (g.session.user.isImpersonating) return { error: 'You cannot remove people while viewing as someone else.' }
  if (!ambassadorId) return { error: 'Something went wrong. Please try again.' }
  try {
    await prisma.ambassadorGroupMember.updateMany({ where: { groupId, ambassadorId, leftAt: null }, data: { leftAt: new Date() } })
    await syncMembership(groupId)
    revalidateGroups(groupId)
    return { success: true }
  } catch (error) {
    console.error('removeGroupMember failed:', error)
    return { error: 'Could not remove them. Please try again.' }
  }
}

const attendanceSchema = z.object({
  sessionId: z.string().min(1),
  ambassadorId: z.string().min(1),
  status: z.enum(['PRESENT', 'ABSENT', 'EXCUSED']),
})

export async function markAttendance(input: z.input<typeof attendanceSchema>): Promise<Result> {
  const parsed = attendanceSchema.safeParse(input)
  if (!parsed.success) return { error: 'Something went wrong. Please try again.' }
  const { sessionId, ambassadorId, status } = parsed.data
  const meeting = await prisma.groupSession.findUnique({ where: { id: sessionId }, select: { groupId: true } })
  if (!meeting) return { error: 'Meeting not found.' }
  const g = await getManagedGroup(meeting.groupId)
  if ('error' in g) return { error: g.error ?? 'Something went wrong.' }
  const member = await prisma.ambassadorGroupMember.findUnique({
    where: { groupId_ambassadorId: { groupId: meeting.groupId, ambassadorId } },
  })
  if (!member) return { error: 'That ambassador is not in this group.' }
  try {
    await prisma.groupAttendance.upsert({
      where: { sessionId_ambassadorId: { sessionId, ambassadorId } },
      create: { sessionId, ambassadorId, status, markedById: g.session.user.id },
      update: { status, markedById: g.session.user.id, markedAt: new Date() },
    })
  } catch (error) {
    console.error('markAttendance failed:', error)
    return { error: 'Could not save that. Please tap again.' }
  }
  revalidatePath(`/coach/groups/${meeting.groupId}/register`)
  return { success: true }
}
