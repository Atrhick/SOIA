import type { Metadata } from 'next'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import { formatCallTime } from '@/lib/get-involved/core'
import { verifyEmailToken } from '@/lib/get-involved/email-links'
import { EmailLinkClient } from './email-link-client'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Your email settings | NowTransformed', robots: { index: false, follow: false } }

/**
 * One-tap links from Get Involved emails. Opening the page (GET) never changes anything, so link
 * scanners are harmless: the person presses the button, which posts to runEmailLink().
 */
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="max-w-lg mx-auto bg-white border border-gray-200 rounded-2xl p-8 text-center">
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      <div className="mt-3 text-gray-600 space-y-3">{children}</div>
    </div>
  )
}

const Invalid = () => (
  <Card title="This link isn't valid">
    <p>It may have been copied incompletely. If you need help, just reply to any of our emails.</p>
  </Card>
)

export default async function EmailLinkPage({ params }: { params: { token: string } }) {
  const token = String(params.token ?? '')
  const v = verifyEmailToken(token)
  if (!v) return <Invalid />

  if (v.action === 'confirm') {
    const c = await prisma.discoveryCall.findUnique({ where: { id: v.id }, select: { status: true, startsAt: true, timezone: true, attendanceConfirmedAt: true, prospect: { select: { firstName: true, journeyToken: true } } } })
    if (!c || c.status !== 'BOOKED' || c.startsAt <= new Date()) {
      return <Card title="This call isn't on the calendar any more"><p>It may have already happened, moved or been cancelled. Your latest email has the current details.</p></Card>
    }
    const when = formatCallTime(c.startsAt, c.timezone)
    if (c.attendanceConfirmedAt) return <Card title="You're confirmed"><p>Thanks, {c.prospect.firstName}. See you on {when}.</p></Card>
    return (
      <EmailLinkClient
        token={token}
        title="Can you still make it?"
        lines={[`Your free call is on ${when}.`]}
        button="Yes, I'll be there"
        secondary={c.prospect.journeyToken ? { label: 'I need another time', href: `/discovery/${c.prospect.journeyToken}` } : null}
      />
    )
  }

  if (v.action === 'istop') {
    const inv = await prisma.outreachInvite.findUnique({ where: { id: v.id }, select: { email: true, firstName: true } })
    if (!inv) return <Card title="This link no longer applies"><p>If you need help, reply to the person who invited you.</p></Card>
    const already = await prisma.emailSuppression.findUnique({ where: { email: inv.email }, select: { email: true } })
    if (already) return <Card title="You're all set"><p>You won&apos;t get invitations like this from anyone at NowTransformed again.</p></Card>
    return <EmailLinkClient kind="invite-stop" token={token} title="Stop invitations like this?" lines={[`Hi ${inv.firstName}, press the button and nobody at NowTransformed will be able to send you an invitation like this again.`]} button="Stop invitations" />
  }

  const p = await prisma.prospect.findUnique({ where: { id: v.id }, select: { firstName: true, status: true, emailOptOutAt: true, checkInAt: true, checkInSentAt: true } })

  switch (v.action) {
    case 'stop':
      if (!p) return <Card title="Nothing to stop"><p>We don&apos;t have your details any more.</p></Card>
      if (p.emailOptOutAt) return <Card title="You're unsubscribed"><p>We won&apos;t send you more emails about this.</p></Card>
      return <EmailLinkClient token={token} title="Stop emails about this?" lines={[`Hi ${p.firstName}, press the button and we won't send you any more emails about the program you asked about.`, "If you have a call booked, you'll still get a reminder the day before and an hour before."]} button="Stop emails" />
    case 'delete':
      if (!p) return <Card title="Your details are deleted"><p>We don&apos;t hold your details any more.</p></Card>
      return <EmailLinkClient token={token} title="Delete my details?" lines={[`Hi ${p.firstName}, this deletes your name, contact details and answers from our records, and cancels any call you have booked.`, "This can't be undone."]} button="Yes, delete my details" danger />
    case 'later':
      if (!p || p.status !== 'FORM_SUBMITTED' || p.emailOptOutAt) return <Card title="This link no longer applies"><p>If you need help, just reply to any of our emails.</p></Card>
      if (p.checkInSentAt) return <Card title="We already checked in"><p>Whenever you&apos;re ready, use the link in our last email to pick a call time.</p></Card>
      if (p.checkInAt) return <Card title="We'll check in next month"><p>Until then, no more reminders.</p></Card>
      return <EmailLinkClient token={token} title="Check in next month?" lines={[`No problem, ${p.firstName}. We'll stop the reminders and send you one short note next month.`]} button="Yes, check in next month" />
    case 'callme':
      if (!p || !['FORM_SUBMITTED', 'DISCOVERY_BOOKED'].includes(p.status)) return <Card title="This link no longer applies"><p>If you need help, just reply to any of our emails.</p></Card>
      return <EmailLinkClient token={token} title="Would you like us to call you?" lines={[`Hi ${p.firstName}, press the button and someone from our team will reach out to you.`]} button="Yes, please call me" />
  }
  return (
    <Card title="This link isn't valid"><p><Link href="/" className="text-primary-700 underline">Go to the home page</Link></p></Card>
  )
}
