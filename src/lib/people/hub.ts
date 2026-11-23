/**
 * Admin person page (/admin/people/[userId]): everything one person is part of, read in one go.
 * Server only, NOT 'use server' (nothing here is a public endpoint). The page checks ADMIN before calling.
 * Read-only; every list has a `take` limit and the queries run in parallel.
 */
import prisma from '@/lib/prisma'
import { rolesOf } from '@/lib/roles'
import { BUSINESS_TZ } from '@/lib/get-involved/core'
import { getOutreachStreaks } from '@/lib/get-involved/outreach-streak'
import { currentWeek } from '@/lib/groups/current-week'
import { loadWeekStatuses } from '@/lib/groups/week-status-server'
import { PAGE_INCLUDE, namesForUsers, ownerOfRow, rootIdOf, stageFactsFrom, summarize, type PageRow } from '@/lib/program-info/server'
import { teamView } from '@/lib/program-info/stage'
import { teamPagePath } from '@/lib/program-info/paths'
import {
  AMBASSADOR_STATUS_LABELS, ACCOUNT_STATUS_LABELS, BUSINESS_IDEA_LABELS, SPONSORSHIP_LABELS, SUPPORT_STATUS_LABELS,
  activityLines, ageOn, ago, firstNameOf, personPath, hoursFrom, monthStartIn, percent, plural, roleLabel, sentenceCase, weekLine,
  type ActivityLine, type Area, type AreaItem,
} from './hub-core'

export { personPath }

export interface PersonLinkRef {
  name: string
  /** Their own person page, when they have a login. */
  href: string | null
  sub?: string | null
}

export interface PersonHeader {
  userId: string
  name: string
  firstName: string
  email: string
  phone: string | null
  roles: string[]
  roleLabels: string[]
  status: string
  statusLabel: string
  joinedAt: string
  lastLoginAt: string | null
  lastSeenAt: string | null
  age: number | null
  ambassadorStatusLabel: string | null
  coachStatusLabel: string | null
  coach: PersonLinkRef | null
  parent: PersonLinkRef | null
  children: PersonLinkRef[]
  /** Views "View as" may open (role held, profile exists, account active). */
  viewAs: ('COACH' | 'AMBASSADOR')[]
  coachProfileId: string | null
}

export interface PersonHub {
  header: PersonHeader
  areas: Area[]
  activity: ActivityLine[]
}

const LIST = 8
const fmtDay = (d: Date, tz = BUSINESS_TZ) => new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(d)
const fmtDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: BUSINESS_TZ })
const full = (p: { firstName: string; lastName: string }) => `${p.firstName} ${p.lastName}`.trim()
const phoneOf = (phone: string | null | undefined, cc?: string | null) => (phone ? (cc && cc !== 'US' ? `${phone} (${cc})` : phone) : null)

export async function loadPersonHub(userId: string, now = new Date()): Promise<PersonHub | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, role: true, extraRoles: true, status: true, createdAt: true, lastLoginAt: true, lastSeenAt: true,
      coachProfile: {
        select: {
          id: true, firstName: true, lastName: true, phone: true, coachStatus: true,
          _count: { select: { ambassadors: true, recruitedCoaches: true } },
        },
      },
      ambassadorProfile: {
        select: {
          id: true, firstName: true, lastName: true, phone: true, phoneCountryCode: true, dateOfBirth: true, status: true,
          parentFirstName: true, parentLastName: true, parentEmail: true, parentPhone: true, parentRelationship: true, parentUserId: true,
          coach: { select: { id: true, firstName: true, lastName: true, userId: true } },
          businessIdea: { select: { title: true, status: true, submittedAt: true, updatedAt: true } },
        },
      },
      parentOfAmbassador: { select: { firstName: true, lastName: true, userId: true, status: true } },
      associateProfile: { select: { firstName: true, lastName: true, phone: true, type: true, status: true, organization: true, coach: { select: { firstName: true, lastName: true, userId: true } } } },
      discoveryHost: { select: { displayName: true, active: true } },
    },
  })
  if (!user) return null

  const coach = user.coachProfile
  const amb = user.ambassadorProfile
  const roles = rolesOf(user)
  const isCoach = !!coach
  const isAmb = !!amb
  const isInviter = isCoach || isAmb
  const monthStart = monthStartIn(now, BUSINESS_TZ)
  const auditIds = [user.id, coach?.id, amb?.id].filter((x): x is string => !!x)

  const [
    programs, groupsRun, memberships, coached, recruited, enrollments, enrollmentCount,
    monthEntries, lastEntry, entryCount,
    invitesMonth, sharesMonth, prospectsAll, prospectsMonth, prospectsJoined, streaks,
    callsUpcoming, nextCall, callsKept,
    supportByStatus, supportLatest,
    coachOnb, coachTasks, ambOnb, ambTasks,
    sponsorships, rsvps, submissions, channels, joined, portfolio, portfolioCount, audit,
  ] = await Promise.all([
    loadPrograms(user.id),
    coach
      ? prisma.ambassadorGroup.findMany({
          where: { coachId: coach.id },
          orderBy: [{ isActive: 'desc' }, { startDate: 'desc' }],
          take: LIST,
          select: {
            id: true, name: true, isActive: true, timezone: true,
            _count: { select: { members: { where: { leftAt: null } } } },
            sessions: { where: { startsAt: { gte: now }, cancelled: false }, orderBy: { startsAt: 'asc' }, take: 1, select: { startsAt: true } },
          },
        })
      : [],
    amb
      ? prisma.ambassadorGroupMember.findMany({
          where: { ambassadorId: amb.id, leftAt: null },
          orderBy: { joinedAt: 'desc' },
          take: LIST,
          select: {
            group: {
              select: {
                id: true, name: true, isActive: true, timezone: true, startDate: true, weeks: true,
                coach: { select: { firstName: true, lastName: true } },
                _count: { select: { members: { where: { leftAt: null } } } },
                sessions: { where: { startsAt: { gte: now }, cancelled: false }, orderBy: { startsAt: 'asc' }, take: 1, select: { startsAt: true } },
              },
            },
          },
        })
      : [],
    coach
      ? prisma.ambassador.findMany({ where: { coachId: coach.id }, orderBy: { firstName: 'asc' }, take: 12, select: { id: true, firstName: true, lastName: true, status: true, userId: true } })
      : [],
    coach
      ? prisma.coachProfile.findMany({ where: { recruiterId: coach.id }, orderBy: { createdAt: 'desc' }, take: LIST, select: { firstName: true, lastName: true, userId: true, coachStatus: true } })
      : [],
    prisma.lMSEnrollment.findMany({
      where: { userId: user.id },
      orderBy: [{ lastAccessedAt: { sort: 'desc', nulls: 'last' } }, { enrolledAt: 'desc' }],
      take: LIST,
      select: { courseId: true, progressPercentage: true, status: true, lastAccessedAt: true, course: { select: { title: true } } },
    }),
    prisma.lMSEnrollment.count({ where: { userId: user.id } }),
    prisma.timeEntry.findMany({ where: { userId: user.id, startTime: { gte: monthStart } }, select: { startTime: true, endTime: true }, take: 1000 }),
    prisma.timeEntry.findFirst({ where: { userId: user.id }, orderBy: { startTime: 'desc' }, select: { startTime: true, endTime: true, description: true, project: { select: { name: true } } } }),
    prisma.timeEntry.count({ where: { userId: user.id } }),
    isInviter ? prisma.outreachInvite.count({ where: { userId: user.id, status: 'SENT', sentAt: { gte: monthStart } } }) : 0,
    isInviter ? prisma.outreachShare.count({ where: { userId: user.id, sentAt: { gte: monthStart }, firstName: { not: null } } }) : 0,
    isInviter ? prisma.prospect.count({ where: { invitedById: user.id } }) : 0,
    isInviter ? prisma.prospect.count({ where: { invitedById: user.id, createdAt: { gte: monthStart } } }) : 0,
    isInviter ? prisma.prospect.count({ where: { invitedById: user.id, userId: { not: null } } }) : 0,
    isInviter ? getOutreachStreaks([user.id], now) : new Map(),
    prisma.discoveryCall.count({ where: { hostId: user.id, status: 'BOOKED', startsAt: { gte: now } } }),
    prisma.discoveryCall.findFirst({ where: { hostId: user.id, status: 'BOOKED', startsAt: { gte: now } }, orderBy: { startsAt: 'asc' }, select: { startsAt: true } }),
    prisma.discoveryCall.count({ where: { hostId: user.id, status: 'KEPT' } }),
    prisma.supportMessage.groupBy({ by: ['status'], where: { senderId: user.id }, _count: { _all: true } }),
    prisma.supportMessage.findFirst({ where: { senderId: user.id }, orderBy: { lastActivityAt: 'desc' }, select: { id: true, subject: true, status: true, lastActivityAt: true } }),
    coach ? prisma.coachOnboardingProgress.count({ where: { coachId: coach.id, status: 'APPROVED', task: { isActive: true, isRequired: true } } }) : 0,
    coach ? prisma.onboardingTask.count({ where: { isActive: true, isRequired: true } }) : 0,
    amb ? prisma.ambassadorOnboardingProgress.count({ where: { ambassadorId: amb.id, status: 'APPROVED', task: { isActive: true, isRequired: true } } }) : 0,
    amb ? prisma.ambassadorOnboardingTask.count({ where: { isActive: true, isRequired: true } }) : 0,
    isInviter
      ? prisma.sponsorshipRequest.findMany({
          where: { OR: [...(coach ? [{ coachId: coach.id }] : []), ...(amb ? [{ ambassadorId: amb.id }] : [])] },
          orderBy: { createdAt: 'desc' },
          take: LIST,
          select: { id: true, status: true, amountRequested: true, createdAt: true, requestType: true },
        })
      : [],
    coach
      ? prisma.eventRSVP.findMany({ where: { coachId: coach.id }, orderBy: { event: { startDate: 'desc' } }, take: LIST, select: { status: true, event: { select: { name: true, startDate: true } } } })
      : [],
    prisma.surveySubmission.findMany({
      where: { OR: [{ userId: user.id }, { contactEmail: { equals: user.email, mode: 'insensitive' } }] },
      orderBy: { submittedAt: 'desc' },
      take: LIST,
      select: { id: true, surveyId: true, submittedAt: true, score: true, passed: true, survey: { select: { title: true, type: true } } },
    }),
    prisma.channelMember.count({ where: { userId: user.id, channel: { type: 'CHANNEL' } } }),
    prisma.prospect.findUnique({
      where: { userId: user.id },
      select: { id: true, createdAt: true, joinedAt: true, journeyRole: true, invitedBy: { select: { id: true } }, program: { select: { name: true } } },
    }),
    amb ? prisma.portfolioSubmission.findFirst({ where: { ambassadorId: amb.id }, orderBy: { submittedAt: 'desc' }, select: { title: true, weekNo: true, status: true, submittedAt: true, groupId: true } }) : null,
    amb ? prisma.portfolioSubmission.count({ where: { ambassadorId: amb.id } }) : 0,
    prisma.auditLog.findMany({
      where: { OR: [{ userId: user.id }, { entityId: { in: auditIds } }] },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, userId: true, action: true, entityType: true, entityId: true, createdAt: true },
    }),
  ])

  // This week (ambassador): the active group they are in, if any.
  const activeGroup = memberships.map((m) => m.group).find((g) => g.isActive) ?? null
  let weekArea: Area | null = null
  if (amb) {
    if (activeGroup) {
      const live = currentWeek(activeGroup.startDate, activeGroup.weeks, now)
      const before = now.getTime() < activeGroup.startDate.getTime()
      const weekNo = live ?? (before ? 1 : activeGroup.weeks)
      const w = (await loadWeekStatuses(activeGroup, weekNo, [{ id: amb.id, userId: user.id }])).get(amb.id)!
      const tick = (ok: boolean) => (ok ? 'Done' : 'Not yet')
      weekArea = {
        key: 'week',
        title: 'This week',
        status: weekLine(w, activeGroup.weeks, live ? 'live' : before ? 'before' : 'after'),
        empty: false,
        items: [
          { label: 'Learn (a lesson)', sub: tick(w.learn) },
          { label: 'Meet (group meeting)', sub: w.meet.state === 'NO_MEETING' ? 'No meeting this week' : w.meet.state === 'CANCELLED' ? 'Meeting cancelled' : w.meet.state === 'NOT_MARKED' ? 'Not marked yet' : sentenceCase(w.meet.state) },
          { label: 'Show (portfolio piece)', sub: w.show.state === 'NONE' ? 'Not yet' : w.show.state === 'HANDED_IN' ? 'Handed in' : w.show.state === 'REPLIED' ? 'Coach replied' : 'Asked to redo' },
          { label: 'Invite (one person)', sub: tick(w.invite) },
        ],
        links: [{ label: 'Open the group week', href: `/coach/groups/${activeGroup.id}/week` }],
      }
    } else {
      weekArea = { key: 'week', title: 'This week', status: 'Not in a group yet', empty: true, links: [] }
    }
  }

  const areas: Area[] = []

  // Program pages
  areas.push({
    key: 'programs',
    title: 'Program pages',
    status: programs.length ? `${plural(programs.length, 'page')} · ${plural(programs.filter((p) => p.live).length, 'live', 'live')}` : 'No program pages',
    empty: programs.length === 0,
    items: programs.slice(0, LIST).map((p) => p.item),
    more: Math.max(0, programs.length - LIST),
    links: [{ label: 'Open program pages', href: '/admin/program-pages' }],
  })

  // Groups
  const groupItems: AreaItem[] = [
    ...groupsRun.map((g) => ({
      label: g.name,
      sub: `Runs it · ${plural(g._count.members, 'member')}${g.isActive ? '' : ' · finished'}${g.sessions[0] ? ` · next meeting ${fmtDay(g.sessions[0].startsAt, g.timezone)}` : ''}`,
      href: `/coach/groups/${g.id}`,
    })),
    ...memberships.map(({ group: g }) => ({
      label: g.name,
      sub: `Member · coach ${full(g.coach)} · ${plural(g._count.members, 'member')}${g.isActive ? '' : ' · finished'}${g.sessions[0] ? ` · next meeting ${fmtDay(g.sessions[0].startsAt, g.timezone)}` : ''}`,
      href: `/coach/groups/${g.id}`,
    })),
  ]
  if (isCoach || isAmb) {
    areas.push({
      key: 'groups',
      title: 'Groups',
      status: groupItems.length
        ? [groupsRun.length ? `Runs ${plural(groupsRun.length, 'group')}` : '', memberships.length ? `In ${plural(memberships.length, 'group')}` : ''].filter(Boolean).join(' · ')
        : 'Not in any group',
      empty: groupItems.length === 0,
      items: groupItems,
      links: groupItems[0]?.href ? [{ label: 'Open the group', href: groupItems[0].href }] : [],
    })
  }

  if (weekArea) areas.push(weekArea)

  // Portfolio (ambassador)
  if (amb) {
    areas.push({
      key: 'portfolio',
      title: 'Portfolio',
      status: portfolio ? `${plural(portfolioCount, 'piece')} · latest: week ${portfolio.weekNo}, ${portfolio.status === 'REVIEWED' ? 'coach replied' : portfolio.status === 'REDO' ? 'asked to redo' : 'handed in'} ${ago(portfolio.submittedAt, now)}` : 'No pieces handed in',
      empty: portfolioCount === 0,
      items: portfolio ? [{ label: portfolio.title, sub: `Week ${portfolio.weekNo} · ${fmtDate(portfolio.submittedAt)}` }] : [],
      links: [{ label: 'Open portfolio', href: portfolio?.groupId ? `/coach/portfolio?group=${portfolio.groupId}` : '/coach/portfolio' }],
      note: portfolio?.groupId ? 'Shows the whole group, not just this person.' : 'Shows every portfolio piece, not just this person.',
    })
  }

  // Ambassadors they coach
  if (coach) {
    areas.push({
      key: 'ambassadors',
      title: 'Ambassadors they coach',
      status: coach._count.ambassadors ? plural(coach._count.ambassadors, 'ambassador') : 'No ambassadors yet',
      empty: coach._count.ambassadors === 0,
      items: coached.map((a) => ({ label: full(a), sub: AMBASSADOR_STATUS_LABELS[a.status] ?? sentenceCase(a.status), href: a.userId ? personPath(a.userId) : null })),
      more: Math.max(0, coach._count.ambassadors - coached.length),
      links: [{ label: 'Open ambassadors', href: `/admin/ambassadors?q=${encodeURIComponent(full(coach))}` }],
      note: 'The ambassadors list is searched by name, so it can also show ambassadors whose own name matches.',
    })
    areas.push({
      key: 'recruited',
      title: 'Coaches they brought in',
      status: coach._count.recruitedCoaches ? plural(coach._count.recruitedCoaches, 'coach', 'coaches') : 'None yet',
      empty: coach._count.recruitedCoaches === 0,
      items: recruited.map((c) => ({ label: full(c), sub: c.coachStatus === 'ACTIVE_COACH' ? 'Fully onboarded' : 'Still onboarding', href: personPath(c.userId) })),
      more: Math.max(0, coach._count.recruitedCoaches - recruited.length),
      links: [],
    })
  }

  // Onboarding
  if (coach) {
    areas.push({
      key: 'coach-onboarding',
      title: 'Coach onboarding',
      status: coach.coachStatus === 'ACTIVE_COACH' ? 'Fully onboarded' : `Still onboarding · ${Math.min(coachOnb, coachTasks)} of ${coachTasks} steps done`,
      empty: false,
      links: [{ label: 'Open coach record', href: `/admin/coaches/${coach.id}` }],
    })
  }
  if (amb) {
    areas.push({
      key: 'amb-onboarding',
      title: 'Ambassador onboarding',
      status: `${Math.min(ambOnb, ambTasks)} of ${ambTasks} steps approved · ${AMBASSADOR_STATUS_LABELS[amb.status] ?? sentenceCase(amb.status)}`,
      empty: false,
      links: [{ label: 'Open ambassador onboarding', href: '/admin/ambassador-onboarding' }],
      note: 'Shows every ambassador, not just this person.',
    })
    const idea = amb.businessIdea
    areas.push({
      key: 'idea',
      title: 'Business idea',
      status: idea ? `${BUSINESS_IDEA_LABELS[idea.status] ?? sentenceCase(idea.status)} · “${idea.title}”` : 'Not started',
      empty: !idea,
      links: [{ label: 'Open business ideas', href: '/admin/business-ideas' }],
      note: 'Shows every business idea, not just this person.',
    })
  }

  // Learning
  areas.push({
    key: 'learning',
    title: 'Learning',
    status: enrollmentCount
      ? `${plural(enrollmentCount, 'course')}${enrollments[0]?.lastAccessedAt ? ` · last opened ${ago(enrollments[0].lastAccessedAt, now)}` : ''}`
      : 'No courses started',
    empty: enrollmentCount === 0,
    items: enrollments.map((e) => ({ label: e.course.title, sub: `${percent(e.progressPercentage)} done${e.lastAccessedAt ? ` · last opened ${ago(e.lastAccessedAt, now)}` : ''}` })),
    more: Math.max(0, enrollmentCount - enrollments.length),
    links: [{ label: 'Open course reports', href: '/admin/lms/analytics' }],
    note: 'The course reports cover everyone, not just this person.',
  })

  // Time clock
  const hours = hoursFrom(monthEntries, now)
  areas.push({
    key: 'time',
    title: 'Time clock',
    status: entryCount
      ? `${hours} hours this month${lastEntry ? ` · last entry ${ago(lastEntry.startTime, now)}${lastEntry.endTime ? '' : ' (timer running)'}` : ''}`
      : 'No time recorded',
    empty: entryCount === 0,
    items: lastEntry ? [{ label: lastEntry.description || lastEntry.project?.name || 'Last entry', sub: fmtDay(lastEntry.startTime) }] : [],
    links: [{ label: 'Open timesheets', href: '/admin/time' }],
    note: 'Timesheets show everyone; look for this person in the week.',
  })

  // One-A-Day
  if (isInviter) {
    const streak = (streaks as Map<string, { streak: number }>).get(user.id)?.streak ?? 0
    const sent = invitesMonth + sharesMonth
    areas.push({
      key: 'one-a-day',
      title: 'One-A-Day invites',
      status: `${plural(sent, 'invite')} this month · ${plural(prospectsMonth, 'sign-up')} this month · streak ${plural(streak, 'day')}`,
      empty: sent === 0 && prospectsAll === 0 && streak === 0,
      items: [
        { label: 'People who signed up from their link', sub: `${prospectsAll} in total · ${prospectsJoined} now have a login`, href: prospectsAll ? `/admin/prospects?inviter=${encodeURIComponent(user.id)}` : null },
      ],
      links: [
        { label: 'Open One-A-Day', href: '/admin/one-a-day' },
        ...(prospectsAll ? [{ label: 'People they invited', href: `/admin/prospects?inviter=${encodeURIComponent(user.id)}` }] : []),
      ],
    })
  }

  // Discovery calls they host
  if (user.discoveryHost || callsUpcoming || callsKept) {
    areas.push({
      key: 'calls',
      title: 'Discovery calls they host',
      status: `${plural(callsUpcoming, 'upcoming call')}${nextCall ? ` · next ${fmtDay(nextCall.startsAt)} (Central)` : ''} · ${callsKept} kept so far${user.discoveryHost && !user.discoveryHost.active ? ' · host paused' : ''}`,
      empty: false,
      links: [
        { label: 'Open discovery calls', href: '/admin/discovery-calls?who=all' },
        { label: 'Hosts', href: '/admin/discovery-calls/hosts' },
      ],
      note: 'The calls list shows every host.',
    })
  }

  // Support messages
  const supportTotal = supportByStatus.reduce((n, s) => n + s._count._all, 0)
  const supportOpen = supportByStatus.filter((s) => s.status !== 'DONE').reduce((n, s) => n + s._count._all, 0)
  if (!roles.includes('ADMIN') || supportTotal > 0) {
    areas.push({
      key: 'support',
      title: 'Support messages they sent',
      status: supportTotal ? `${supportOpen} open · ${supportTotal} in total` : 'None sent',
      empty: supportTotal === 0,
      items: supportLatest ? [{ label: supportLatest.subject, sub: `${SUPPORT_STATUS_LABELS[supportLatest.status] ?? supportLatest.status} · ${ago(supportLatest.lastActivityAt, now)}`, href: `/admin/support/${supportLatest.id}` }] : [],
      links: [{ label: 'Open their messages', href: `/admin/support?filter=${supportOpen ? 'open' : 'done'}&q=${encodeURIComponent(user.email)}` }],
    })
  }

  // Sponsorship requests
  if (isInviter) {
    areas.push({
      key: 'sponsorship',
      title: 'Sponsorship requests',
      status: sponsorships.length ? `${plural(sponsorships.length, 'request')}${sponsorships.length >= LIST ? '+' : ''} · latest: ${SPONSORSHIP_LABELS[sponsorships[0].status] ?? sponsorships[0].status}` : 'None',
      empty: sponsorships.length === 0,
      items: sponsorships.map((s) => ({ label: `$${Number(s.amountRequested).toLocaleString('en-US')} · ${sentenceCase(s.requestType)}`, sub: `${SPONSORSHIP_LABELS[s.status] ?? s.status} · ${fmtDate(s.createdAt)}` })),
      links: [{ label: 'Open sponsorship requests', href: '/admin/sponsorship' }],
      note: 'Shows every request, not just this person.',
    })
  }

  // Events
  if (coach) {
    areas.push({
      key: 'events',
      title: 'Event replies',
      status: rsvps.length ? `${plural(rsvps.filter((r) => r.status === 'YES').length, 'yes', 'yes')} · ${plural(rsvps.length, 'reply', 'replies')}` : 'No replies',
      empty: rsvps.length === 0,
      items: rsvps.map((r) => ({ label: r.event.name, sub: `${r.status === 'YES' ? 'Going' : r.status === 'NO' ? 'Not going' : 'Maybe'} · ${fmtDate(r.event.startDate)}` })),
      links: [{ label: 'Open events', href: '/admin/events' }],
    })
  }

  // Surveys and assessments
  areas.push({
    key: 'surveys',
    title: 'Surveys and quizzes',
    status: submissions.length ? `${plural(submissions.length, 'answered', 'answered')}${submissions.length >= LIST ? '+' : ''} · latest ${ago(submissions[0].submittedAt, now)}` : 'None answered',
    empty: submissions.length === 0,
    items: submissions.map((s) => ({
      label: s.survey.title,
      sub: `${s.survey.type === 'QUIZ' ? (s.passed === true ? 'Passed' : s.passed === false ? 'Not passed' : 'Quiz') : 'Survey'}${s.score != null ? ` · ${percent(s.score)}` : ''} · ${fmtDate(s.submittedAt)}`,
      href: `/admin/surveys/${s.surveyId}/results`,
    })),
    links: submissions[0] ? [{ label: 'Open the latest results', href: `/admin/surveys/${submissions[0].surveyId}/results` }] : [],
  })

  // Team chat
  if (roles.some((r) => r === 'ADMIN' || r === 'COACH' || r === 'AMBASSADOR')) {
    areas.push({
      key: 'channels',
      title: 'Team chat',
      status: channels ? `In ${plural(channels, 'channel')}` : 'Not in any channel',
      empty: channels === 0,
      links: [{ label: 'Open channels', href: '/admin/collaboration/channels' }],
    })
  }

  // How they joined
  if (joined) {
    const inviter = joined.invitedBy ? (await namesForUsers([joined.invitedBy.id])).get(joined.invitedBy.id) : null
    areas.push({
      key: 'joined',
      title: 'How they joined',
      status: `Signed up ${fmtDate(joined.createdAt)}${inviter ? ` from ${inviter}'s invite` : ''}${joined.program ? ` · ${joined.program.name}` : ''}`,
      empty: false,
      items: joined.invitedBy && inviter ? [{ label: `Invited by ${inviter}`, href: personPath(joined.invitedBy.id) }] : [],
      links: [{ label: 'Open their sign-up record', href: `/admin/prospects/${joined.id}` }],
    })
  }

  // Associate
  if (user.associateProfile) {
    const a = user.associateProfile
    areas.push({
      key: 'associate',
      title: 'Associate',
      status: `${roleLabel(a.type)} · ${a.status === 'ACTIVE' ? 'Active' : sentenceCase(a.status)}${a.organization ? ` · ${a.organization}` : ''}`,
      empty: false,
      items: a.coach ? [{ label: `Sponsored by ${full(a.coach)}`, href: personPath(a.coach.userId) }] : [],
      links: [{ label: 'Open associates', href: '/admin/associates' }],
    })
  }

  // Recent activity: what they did and what was done to their account.
  const actorNames = await namesForUsers(audit.map((r) => r.userId))
  const activity = activityLines(audit, user.id, actorNames)

  const profile = coach ?? amb ?? user.associateProfile
  const name = profile ? full(profile) : user.discoveryHost?.displayName ?? user.email.split('@')[0]
  const child = user.parentOfAmbassador
  const viewAs = user.status === 'ACTIVE'
    ? (['COACH', 'AMBASSADOR'] as const).filter((r) => roles.includes(r) && (r === 'COACH' ? !!coach : !!amb))
    : []
  const age = ageOn(amb?.dateOfBirth, now)

  return {
    header: {
      userId: user.id,
      name,
      firstName: firstNameOf(name, user.email),
      email: user.email,
      phone: phoneOf(coach?.phone ?? amb?.phone ?? user.associateProfile?.phone, amb?.phone ? amb.phoneCountryCode : null),
      roles,
      roleLabels: roles.map(roleLabel),
      status: user.status,
      statusLabel: ACCOUNT_STATUS_LABELS[user.status] ?? sentenceCase(user.status),
      joinedAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
      age,
      ambassadorStatusLabel: amb ? AMBASSADOR_STATUS_LABELS[amb.status] ?? sentenceCase(amb.status) : null,
      coachStatusLabel: coach ? (coach.coachStatus === 'ACTIVE_COACH' ? 'Fully onboarded' : 'Still onboarding') : null,
      coach: amb ? { name: full(amb.coach), href: amb.coach.userId ? personPath(amb.coach.userId) : null } : null,
      parent: amb && (amb.parentFirstName || amb.parentUserId)
        ? {
            name: `${amb.parentFirstName ?? ''} ${amb.parentLastName ?? ''}`.trim() || 'Parent or guardian',
            href: amb.parentUserId ? personPath(amb.parentUserId) : null,
            sub: [amb.parentRelationship, amb.parentEmail, amb.parentPhone].filter(Boolean).join(' · ') || null,
          }
        : null,
      children: child ? [{ name: full(child), href: child.userId ? personPath(child.userId) : null, sub: AMBASSADOR_STATUS_LABELS[child.status] ?? null }] : [],
      viewAs: [...viewAs],
      coachProfileId: coach?.id ?? null,
    },
    areas,
    activity,
  }
}

/** Program pages this person owns (as coach or ambassador), labelled the way the team queue labels them. */
async function loadPrograms(userId: string): Promise<{ live: boolean; item: AreaItem }[]> {
  const roots = await prisma.coachProgram.findMany({
    where: { parentProgramId: null, OR: [{ coach: { userId }, ambassadorId: null }, { ambassador: { userId }, coachId: null }] },
    select: { id: true },
    take: 20,
  })
  if (roots.length === 0) return []
  const rootIds = roots.map((r) => r.id)
  const rows: PageRow[] = await prisma.coachProgram.findMany({
    where: { OR: [{ id: { in: rootIds } }, { parentProgramId: { in: rootIds } }] },
    include: PAGE_INCLUDE,
    orderBy: { createdAt: 'asc' },
    take: 60,
  })
  const byId = new Map(rows.map((r) => [r.id, r]))
  return rows.map((page) => {
    const root = byId.get(rootIdOf(page)) ?? page
    const owner = ownerOfRow(root)
    const facts = stageFactsFrom(page, root, owner)
    const team = teamView(facts)
    const s = summarize(page, root, owner)
    return {
      live: s.isLive,
      item: {
        label: s.pageName,
        sub: `${team.label} · ${plural(s.leadCount, 'sign-up')}`,
        href: teamPagePath(page.id),
        secondary: s.liveUrl ? { label: 'See it live', href: s.liveUrl, external: true } : null,
      },
    }
  })
}
