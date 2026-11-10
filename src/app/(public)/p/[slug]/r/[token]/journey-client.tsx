'use client'

import { useMemo, useState, useTransition } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AlertBanner } from '@/components/ui/alert-banner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Heart,
  Loader2,
  ShieldCheck,
  Video,
} from 'lucide-react'
import {
  AGE_BAND_LABELS,
  audienceIncludesChildren,
  type ProgramChild,
  type ProgramQuestion,
} from '@/lib/program-question-types'
import { markLeadInterested, submitQualification } from '@/lib/actions/program-pages'

export interface JourneyData {
  /** Who runs the program: shown as "your coach" or "your ambassador". */
  ownerTerm?: 'coach' | 'ambassador'
  programName: string
  organization: string
  coachVideoEmbedUrl: string | null
  ntVideoEmbedUrl: string | null
  ntVideoIntro: string | null
  /** Null when the coach has switched the meeting off. */
  meeting: {
    zoomUrl: string | null
    zoomLabel: string | null
    secondMeetingUrl: string | null
    secondMeetingLabel: string | null
    zoomInstructions: string | null
    eventDatesText: string | null
  } | null
  qualificationIntro: string | null
  baseQuestions: ProgramQuestion[]
  familyQuestions: ProgramQuestion[]
}

export interface JourneyLead {
  firstName: string
  audience: string | null
  children: ProgramChild[]
  interested: boolean
  submitted: boolean
}

type Step = 'coach' | 'nt' | 'assessment' | 'done'
type AnswerValue = string | number

/**
 * The post-signup journey: coach video, then the NowTransformed / sponsorship
 * video with the "I'm interested" button, then the assessment.
 *
 * A video step is skipped when no video is set, so a program with neither
 * falls back to the original single page (joining details plus the form).
 *
 * With no token this is a preview: nothing is sent to the server.
 */
export function JourneyClient({
  token,
  journey,
  lead,
}: {
  token: string | null
  journey: JourneyData
  lead: JourneyLead
}) {
  const previewMode = token === null
  const term = journey.ownerTerm ?? 'coach'
  const hasChildren = audienceIncludesChildren(lead.audience)
  const questions = useMemo(
    () => [...journey.baseQuestions, ...(hasChildren ? journey.familyQuestions : [])],
    [journey.baseQuestions, journey.familyQuestions, hasChildren]
  )

  const videoSteps: Step[] = [
    ...(journey.coachVideoEmbedUrl ? (['coach'] as const) : []),
    ...(journey.ntVideoEmbedUrl ? (['nt'] as const) : []),
  ]
  const lastVideoStep = videoSteps[videoSteps.length - 1]

  const [step, setStep] = useState<Step>(() => {
    if (lead.submitted) return 'done'
    if (lead.interested || videoSteps.length === 0) return 'assessment'
    return videoSteps[0]
  })
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({})

  const go = (next: Step) => {
    setError(null)
    setStep(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleInterested = () => {
    // Nothing to ask: the click itself is the whole answer.
    const next: Step = questions.length === 0 ? 'done' : 'assessment'
    if (previewMode) return go(next)
    startTransition(async () => {
      const result = await markLeadInterested(token)
      if (result?.error) setError(result.error)
      else go(next)
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (previewMode) return go('done')
    const payload = Object.entries(answers).map(([questionId, value]) => ({ questionId, value }))
    startTransition(async () => {
      const result = await submitQualification(token, payload)
      if (result?.error) setError(result.error)
      else go('done')
    })
  }

  const interestedButton = (
    <Button size="lg" className="w-full" onClick={handleInterested} disabled={isPending}>
      {isPending ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Heart className="h-4 w-4 mr-2" />
      )}
      I&apos;m interested
    </Button>
  )

  const stepNumber = videoSteps.indexOf(step) + 1

  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-sm uppercase tracking-wide text-primary-600 font-medium">
          {journey.organization}
        </p>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">{journey.programName}</h1>
        {stepNumber > 0 && videoSteps.length > 1 && (
          <p className="text-sm text-gray-500 mt-1">
            Video {stepNumber} of {videoSteps.length}
          </p>
        )}
      </div>

      {error && <AlertBanner variant="error" message={error} />}

      {step === 'coach' && journey.coachVideoEmbedUrl && (
        <>
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <h2 className="font-semibold text-gray-900">
                  Welcome, {lead.firstName}. Meet your {term}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Your {term} explains the program and what taking part looks like.
                </p>
              </div>
              <VideoFrame
                src={journey.coachVideoEmbedUrl}
                title={`Your ${term} explains the program`}
              />
              {lastVideoStep === 'coach' ? (
                interestedButton
              ) : (
                <Button size="lg" className="w-full" onClick={() => go('nt')}>
                  Next: NowTransformed and sponsorship
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </CardContent>
          </Card>
          {journey.meeting && <MeetingCard meeting={journey.meeting} />}
        </>
      )}

      {step === 'nt' && journey.ntVideoEmbedUrl && (
        <>
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <h2 className="font-semibold text-gray-900">
                  About NowTransformed and sponsorship
                </h2>
                <p className="text-sm text-gray-500 mt-1 whitespace-pre-wrap">
                  {journey.ntVideoIntro?.trim() ||
                    'Who we are, and the sponsorship opportunities that come with this program.'}
                </p>
              </div>
              <VideoFrame src={journey.ntVideoEmbedUrl} title="NowTransformed and sponsorship" />
              <div className="rounded-lg bg-primary-50 border border-primary-100 p-4 space-y-3">
                <p className="text-sm text-gray-700">
                  Like what you have heard? Tell us you are interested and answer a few short
                  questions so your {term} can follow up with you.
                </p>
                {interestedButton}
              </div>
            </CardContent>
          </Card>
          {videoSteps[0] === 'coach' && (
            <button
              onClick={() => go('coach')}
              className="text-sm text-gray-500 hover:text-gray-800 inline-flex items-center gap-1"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to the {term} video
            </button>
          )}
          {videoSteps[0] === 'nt' && journey.meeting && <MeetingCard meeting={journey.meeting} />}
        </>
      )}

      {step === 'assessment' && (
        <>
          {/* No videos at all: this is the original single page, which led
              with the joining details. */}
          {videoSteps.length === 0 && journey.meeting && <MeetingCard meeting={journey.meeting} />}

          {questions.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <h2 className="font-semibold text-gray-900">A few quick questions</h2>
                <p className="text-sm text-gray-500 mt-1 mb-4">
                  {journey.qualificationIntro?.trim() ||
                    `This helps your ${term} make the next conversation useful for you.`}
                </p>

                <form onSubmit={handleSubmit} className="space-y-6" noValidate>
                  {journey.baseQuestions.map((q) => (
                    <QuestionField
                      key={q.id}
                      question={q}
                      value={answers[q.id]}
                      onChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
                    />
                  ))}

                  {hasChildren && (
                    <div className="space-y-6 pt-4 border-t border-gray-100">
                      <div>
                        <h3 className="font-medium text-gray-900">About your family</h3>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {childrenSummary(lead.children)}. Your answers go to the {term} only.
                        </p>
                      </div>
                      {journey.familyQuestions.map((q) => (
                        <QuestionField
                          key={q.id}
                          question={q}
                          value={answers[q.id]}
                          onChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
                        />
                      ))}
                    </div>
                  )}

                  <Button type="submit" className="w-full" disabled={isPending}>
                    {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {previewMode ? 'Submit (not saved in preview)' : 'Submit'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {step === 'done' && (
        <>
          <Card>
            <CardContent className="pt-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto mb-3" />
              <h2 className="font-semibold text-gray-900">Thank you, {lead.firstName}</h2>
              <p className="text-gray-600 mt-1">
                {hasChildren
                  ? 'We have everything we need. Here is what happens next.'
                  : `Your ${term} will look through your answers and be in touch.`}
              </p>
            </CardContent>
          </Card>
          {hasChildren && <FamilyNextSteps kids={lead.children} term={term} />}
          {journey.meeting && <MeetingCard meeting={journey.meeting} />}
        </>
      )}
    </div>
  )
}

function childrenSummary(kids: ProgramChild[]): string {
  if (kids.length === 0) return 'You told us you are exploring this for your children'
  const names = kids.map((c) => c.firstName)
  const list =
    names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  return `You are exploring this for ${list}`
}

/**
 * The family follow-up promise, shown to the parent after the assessment.
 * Every step is with the parent; the child is never contacted directly. Per
 * child notes set expectations by age before the coach ever calls.
 */
function FamilyNextSteps({
  kids,
  term,
}: {
  kids: ProgramChild[]
  term: 'coach' | 'ambassador'
}) {
  const notes = kids
    .map((c) => ({ child: c, note: ageNote(c, term) }))
    .filter((n): n is { child: ProgramChild; note: string } => n.note !== null)

  return (
    <Card>
      <CardContent className="pt-6 space-y-5">
        <h2 className="font-semibold text-gray-900">What happens next for your family</h2>
        <ol className="space-y-4">
          <NextStep n={1} title={`Your ${term} contacts you within 2 business days`}>
            At the time you told us suits you best. We contact you, the parent or guardian, and
            never your child directly.
          </NextStep>
          <NextStep n={2} title="A short introductory call">
            With you, and your child too if they would like to join. You will talk through whether
            the program is a good fit, the schedule, costs and sponsorship.
          </NextStep>
          <NextStep n={3} title="Enrollment only with your consent">
            If it is a good fit, you decide. For children under 18 you give consent and receive
            your own parent account so you can follow their progress.
          </NextStep>
        </ol>

        {notes.length > 0 && (
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 space-y-2">
            {notes.map(({ child, note }) => (
              <p key={`${child.firstName}-${child.ageBand}`} className="text-sm text-gray-700">
                <span className="font-medium text-gray-900">
                  {child.firstName} ({AGE_BAND_LABELS[child.ageBand]}):
                </span>{' '}
                {note}
              </p>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-500 inline-flex items-start gap-1.5">
          <ShieldCheck className="h-4 w-4 flex-shrink-0 text-gray-400" />
          We only keep your child&apos;s first name and age range. Ask your {term} at any time and
          we will remove them.
        </p>
      </CardContent>
    </Card>
  )
}

function ageNote(child: ProgramChild, term: 'coach' | 'ambassador'): string | null {
  if (child.ageBand === 'UNDER_10') {
    return `Our youth Ambassador program starts at age 10. Your ${term} will talk with you about what is available now and let you know when they become eligible.`
  }
  if (child.ageBand === '18_24') {
    return 'As an adult, they will be asked to confirm their own place, but the first conversation still starts with you.'
  }
  if (child.ageBand === '25_PLUS') {
    return 'They can sign up on this page themselves as an adult. Feel free to pass the link on.'
  }
  // 10-17: squarely in the youth Ambassador range, covered by the steps above.
  return null
}

function NextStep({
  n,
  title,
  children,
}: {
  n: number
  title: string
  children: React.ReactNode
}) {
  return (
    <li className="flex gap-3">
      <span className="flex-shrink-0 h-7 w-7 rounded-full bg-primary-100 text-primary-700 text-sm font-semibold flex items-center justify-center">
        {n}
      </span>
      <div>
        <p className="font-medium text-gray-900">{title}</p>
        <p className="text-sm text-gray-600 mt-0.5">{children}</p>
      </div>
    </li>
  )
}

function VideoFrame({ src, title }: { src: string; title: string }) {
  return (
    <div className="relative w-full overflow-hidden rounded-lg bg-black aspect-video">
      <iframe
        src={src}
        title={title}
        className="absolute inset-0 h-full w-full"
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        loading="lazy"
      />
    </div>
  )
}

function MeetingCard({ meeting }: { meeting: NonNullable<JourneyData['meeting']> }) {
  const dates = (meeting.eventDatesText ?? '')
    .split('\n')
    .map((d) => d.trim())
    .filter(Boolean)

  return (
    <Card className="border-primary-200 bg-primary-50">
      <CardContent className="pt-6 space-y-4">
        <h2 className="font-semibold text-gray-900 inline-flex items-center gap-2">
          <Video className="h-5 w-5 text-primary-600" />
          Join the live session
        </h2>

        {meeting.zoomUrl || meeting.secondMeetingUrl ? (
          <div className="space-y-2">
            {meeting.zoomUrl && (
              <MeetingLink url={meeting.zoomUrl} label={meeting.zoomLabel || 'Zoom'} primary />
            )}
            {meeting.secondMeetingUrl && (
              <MeetingLink
                url={meeting.secondMeetingUrl}
                label={meeting.secondMeetingLabel || 'Second link'}
              />
            )}
            {meeting.zoomUrl && meeting.secondMeetingUrl && (
              <p className="text-xs text-gray-500">
                Either link gets you into the same session. Use whichever you prefer.
              </p>
            )}
          </div>
        ) : (
          <p className="text-gray-600">
            The meeting link will be shared shortly. Please save this page.
          </p>
        )}

        {meeting.zoomInstructions && (
          <p className="whitespace-pre-wrap text-sm text-gray-700">{meeting.zoomInstructions}</p>
        )}

        {dates.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-900 inline-flex items-center gap-1.5 mb-1.5">
              <CalendarDays className="h-4 w-4" />
              Upcoming sessions
            </p>
            <ul className="space-y-1 text-sm text-gray-700">
              {dates.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-xs text-gray-500">
          Bookmark this page. You can come back to it for the link any time.
        </p>
      </CardContent>
    </Card>
  )
}

function MeetingLink({
  url,
  label,
  primary,
}: {
  url: string
  label: string
  primary?: boolean
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={
        primary
          ? 'block rounded-md bg-white border border-primary-200 px-4 py-3 hover:border-primary-400'
          : 'block rounded-md bg-white border border-gray-200 px-4 py-3 hover:border-gray-400'
      }
    >
      <span className="block text-xs uppercase tracking-wide text-gray-500">{label}</span>
      <span className="block break-all text-primary-700 mt-0.5">{url}</span>
    </a>
  )
}

function QuestionField({
  question,
  value,
  onChange,
}: {
  question: ProgramQuestion
  value: AnswerValue | undefined
  onChange: (value: AnswerValue) => void
}) {
  const label = (
    <Label htmlFor={question.id}>
      {question.label}
      {question.required && <span className="text-red-500"> *</span>}
    </Label>
  )

  if (question.type === 'TEXT_LONG') {
    return (
      <div>
        {label}
        <Textarea
          id={question.id}
          rows={4}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    )
  }

  if (question.type === 'DROPDOWN') {
    return (
      <div>
        {label}
        <Select value={(value as string) ?? ''} onValueChange={onChange}>
          <SelectTrigger id={question.id}>
            <SelectValue placeholder="Choose one" />
          </SelectTrigger>
          <SelectContent>
            {(question.options ?? []).map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }

  if (question.type === 'RADIO') {
    return (
      <fieldset>
        <legend className="text-sm font-medium text-gray-900 mb-2">
          {question.label}
          {question.required && <span className="text-red-500"> *</span>}
        </legend>
        <div className="space-y-2">
          {(question.options ?? []).map((opt) => (
            <label key={opt} className="flex items-start gap-2 cursor-pointer">
              <input
                type="radio"
                name={question.id}
                value={opt}
                checked={value === opt}
                onChange={() => onChange(opt)}
                className="mt-1"
              />
              <span className="text-gray-700">{opt}</span>
            </label>
          ))}
        </div>
      </fieldset>
    )
  }

  // LIKERT
  const cfg = question.likert ?? { min: 1, max: 5, minLabel: '', maxLabel: '' }
  const scale: number[] = []
  for (let n = cfg.min; n <= cfg.max; n++) scale.push(n)

  return (
    <fieldset>
      <legend className="text-sm font-medium text-gray-900 mb-2">
        {question.label}
        {question.required && <span className="text-red-500"> *</span>}
      </legend>
      <div className="flex items-center gap-2 flex-wrap">
        {scale.map((n) => (
          <label key={n} className="flex flex-col items-center gap-1 cursor-pointer">
            <input
              type="radio"
              name={question.id}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
            />
            <span className="text-sm text-gray-600 tabular-nums">{n}</span>
          </label>
        ))}
      </div>
      {(cfg.minLabel || cfg.maxLabel) && (
        <div className="flex justify-between text-xs text-gray-500 mt-1 max-w-xs">
          <span>{cfg.minLabel}</span>
          <span>{cfg.maxLabel}</span>
        </div>
      )}
    </fieldset>
  )
}
