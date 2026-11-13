'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
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
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toVideoEmbedUrl, VIDEO_LINK_HINT } from '@/lib/video-embed'
import { EDIT_NAMES_EVENT } from '@/components/program-pages/events'
import { SaveRule } from '@/components/program-pages/save-rule'
import { kit } from '@/components/ui/kit/styles'
import { useToast } from '@/components/ui/kit/toast'
import {
  ArrowLeft,
  Check,
  Copy,
  Eye,
  ExternalLink,
  Loader2,
  Plus,
  Send,
  Trash2,
} from 'lucide-react'
import {
  DEFAULT_LIKERT,
  MAX_EXTRA_QUESTIONS,
  PROGRAM_QUESTION_TYPES,
  QUESTION_TYPE_LABELS,
  type ProgramQuestion,
  type ProgramQuestionType,
} from '@/lib/program-question-types'
import {
  saveExtraQuestions,
  submitProgramForReview,
  updateProgram,
} from '@/lib/actions/program-pages'

interface EditableProgram {
  id: string
  slug: string
  name: string
  organization: string
  targetMarket: string
  internshipOffering: string
  servicesDescription: string
  weeklyEngagement1: string
  weeklyEngagement2: string
  monthlyGrowthGoal: string
  monthlyImpactGoal: string
  pageTitle: string | null
  headline: string | null
  zoomLabel: string | null
  secondMeetingUrl: string | null
  secondMeetingLabel: string | null
  coachBio: string | null
  programDescription: string | null
  eventDatesText: string | null
  zoomUrl: string | null
  zoomInstructions: string | null
  qualificationIntro: string | null
  showMeetingDetails: boolean
  coachVideoUrl: string | null
  ntVideoUrl: string | null
  ntVideoIntro: string | null
  extraQuestions: ProgramQuestion[]
  status: string
  reviewNotes: string | null
  hasLiveVersion: boolean
}

const STATUS_META: Record<
  string,
  { label: string; variant: 'default' | 'success' | 'warning' | 'destructive' | 'outline' }
> = {
  DRAFT: { label: 'Draft', variant: 'outline' },
  PENDING_REVIEW: { label: 'Awaiting review', variant: 'warning' },
  PUBLISHED: { label: 'Live', variant: 'success' },
  REJECTED: { label: 'Needs changes', variant: 'destructive' },
}

function newQuestionId() {
  return `q_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`
}

export function ProgramEditorClient({
  program,
  readOnly,
  standardQuestions,
  basePath = '/coach/programs',
  ownerNoun = 'coach',
}: {
  program: EditableProgram
  readOnly: boolean
  /** The owner's programs list, for the back link. */
  basePath?: string
  /** Who owns the page, for the impersonation banner. */
  ownerNoun?: 'coach' | 'ambassador'
  /** Admin-managed questions asked ahead of the coach's own. Empty when an
   *  admin has switched the standard questions off. */
  standardQuestions: ProgramQuestion[]
}) {
  const [isPending, startTransition] = useTransition()
  const toast = useToast()
  const [copied, setCopied] = useState(false)
  const [tab, setTab] = useState('content')
  const nameRef = useRef<HTMLInputElement>(null)

  // "Change names" in the welcome email panel opens the names fields here.
  useEffect(() => {
    const open = () => {
      setTab('content')
      setTimeout(() => {
        document.getElementById('program-names')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        nameRef.current?.focus({ preventScroll: true })
      }, 50)
    }
    window.addEventListener(EDIT_NAMES_EVENT, open)
    return () => window.removeEventListener(EDIT_NAMES_EVENT, open)
  }, [])

  const [form, setForm] = useState({
    name: program.name,
    organization: program.organization,
    targetMarket: program.targetMarket,
    internshipOffering: program.internshipOffering,
    servicesDescription: program.servicesDescription,
    weeklyEngagement1: program.weeklyEngagement1,
    weeklyEngagement2: program.weeklyEngagement2,
    monthlyGrowthGoal: program.monthlyGrowthGoal,
    monthlyImpactGoal: program.monthlyImpactGoal,
    pageTitle: program.pageTitle ?? '',
    headline: program.headline ?? '',
    zoomLabel: program.zoomLabel ?? '',
    secondMeetingUrl: program.secondMeetingUrl ?? '',
    secondMeetingLabel: program.secondMeetingLabel ?? '',
    coachBio: program.coachBio ?? '',
    programDescription: program.programDescription ?? '',
    eventDatesText: program.eventDatesText ?? '',
    zoomUrl: program.zoomUrl ?? '',
    zoomInstructions: program.zoomInstructions ?? '',
    qualificationIntro: program.qualificationIntro ?? '',
    coachVideoUrl: program.coachVideoUrl ?? '',
    ntVideoUrl: program.ntVideoUrl ?? '',
    ntVideoIntro: program.ntVideoIntro ?? '',
  })
  const [showMeetingDetails, setShowMeetingDetails] = useState(program.showMeetingDetails)
  const [questions, setQuestions] = useState<ProgramQuestion[]>(program.extraQuestions)

  const meta = STATUS_META[program.status] ?? { label: program.status, variant: 'outline' as const }
  const set = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const run = (fn: () => Promise<{ error?: string; success?: boolean }>, okMessage: string, after?: () => void) => {
    startTransition(async () => {
      try {
        const result = await fn()
        if (result?.error) toast.error(result.error)
        else { toast.success(okMessage); after?.() }
      } catch {
        toast.error('That didn’t save. Check your connection and try again.')
      }
    })
  }

  const saveContent = () =>
    run(() => updateProgram(program.id, { ...form, showMeetingDetails }), 'Saved. Press "Submit for review" when you are ready for it to go live.')
  const saveQuestions = () =>
    run(() => saveExtraQuestions(program.id, questions), 'Questions saved. Press "Submit for review" when you are ready.')

  const addQuestion = (type: ProgramQuestionType) => {
    if (questions.length >= MAX_EXTRA_QUESTIONS) {
      toast.error(`You can add at most ${MAX_EXTRA_QUESTIONS} questions. Remove one to add another.`)
      return
    }
    const q: ProgramQuestion = {
      id: newQuestionId(),
      type,
      label: '',
      required: false,
      ...(type === 'DROPDOWN' || type === 'RADIO' ? { options: ['', ''] } : {}),
      ...(type === 'LIKERT' ? { likert: { ...DEFAULT_LIKERT } } : {}),
    }
    setQuestions((prev) => [...prev, q])
  }

  const patchQuestion = (id: string, patch: Partial<ProgramQuestion>) =>
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)))

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/p/${program.slug}`)
      setCopied(true)
      toast.success('Link copied. Paste it wherever you share it.')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Couldn’t copy. Open the live page and copy its address instead.')
    }
  }

  const submitDisabled = isPending || readOnly || program.status === 'PENDING_REVIEW'
  const submit = () => run(() => submitProgramForReview(program.id), 'Sent for review. We’ll email you when it’s approved.')
  const submitLabel = program.status === 'PENDING_REVIEW' ? 'Waiting for review' : 'Submit for review'

  return (
    <div className="space-y-6 min-w-0">
      <div>
        <Link
          href={basePath}
          className={`${kit.quiet} -ml-2 text-gray-700`}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          All programs
        </Link>
      </div>

      <div className="space-y-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-2xl font-bold text-gray-900 break-words min-w-0">{program.name}</h1>
            <Badge variant={meta.variant}>{meta.label}</Badge>
          </div>
          <p className="mt-1 text-base text-gray-700">Keep your program page right. Most changes need a quick review; prices and message details go live at once.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href={`/p/${program.slug}?preview=1`} target="_blank" rel="noreferrer" className={kit.secondary}>
            <Eye className="h-4 w-4" aria-hidden />
            Preview
          </a>
          {program.hasLiveVersion && (
            <>
              <a href={`/p/${program.slug}`} target="_blank" rel="noreferrer" className={kit.secondary}>
                View live
                <ExternalLink className="h-4 w-4" aria-hidden />
              </a>
              <button type="button" onClick={copyLink} className={kit.secondary} aria-label="Copy the link to your live page">
                {copied ? <Check className="h-4 w-4 text-green-600" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
                <span className="hidden sm:inline">Copy link</span>
              </button>
            </>
          )}
          <button type="button" className={`${kit.primary} hidden sm:inline-flex`} disabled={submitDisabled} onClick={submit}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
            {submitLabel}
          </button>
        </div>
      </div>

      {/* Phones: "Submit for review" always within reach at the bottom of the screen. */}
      {!readOnly && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:hidden">
          <button type="button" className={kit.primaryBlock} disabled={submitDisabled} onClick={submit}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
            {submitLabel}
          </button>
        </div>
      )}

      {readOnly && (
        <AlertBanner
          variant="warning"
          title={`Viewing as this ${ownerNoun}`}
          message="You can see everything on this page, but editing is turned off while impersonating. Switch back to your admin account to make changes."
        />
      )}

      {program.hasLiveVersion && (
        <AlertBanner
          variant="info"
          message="Your edits to the page don't change the live page until an admin approves them. Save, then press Submit for review."
        />
      )}

      {program.status === 'REJECTED' && program.reviewNotes && (
        <AlertBanner
          variant="warning"
          title="Changes requested"
          message={program.reviewNotes}
        />
      )}


      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 p-1">
          {[['content', 'Page content'], ['videos', 'Videos'], ['event', 'Event & Zoom'], ['questions', 'Questions'], ['details', 'Program details']].map(([v, l]) => (
            <TabsTrigger key={v} value={v} className="min-h-[44px] px-3 text-base">{l}</TabsTrigger>
          ))}
        </TabsList>

        <fieldset disabled={readOnly} className="min-w-0 [&_input:not([type=checkbox]):not([type=radio])]:h-12 [&_input]:text-base [&_textarea]:text-base [&_label]:text-base [&_button[role=combobox]]:h-12 [&_button[role=combobox]]:text-base">
        {/* ---- Page content ---- */}
        <TabsContent value="content" className="space-y-4">
          <Card id="program-names" className="scroll-mt-24">
            <CardHeader>
              <CardTitle className="text-base">Program and company</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-base text-gray-700">
                Two separate names: what the program is called, and the company or organization that
                runs it. The welcome email uses both as soon as you save; your public page changes after
                an admin approves.
              </p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Program name" htmlFor="name" hint="For example: Health & Stress Management">
                  <Input id="name" ref={nameRef} value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={150} />
                </Field>
                <Field label="Company or organization name" htmlFor="organization" hint="For example: USAWA">
                  <Input
                    id="organization"
                    value={form.organization}
                    onChange={(e) => set('organization', e.target.value)}
                    maxLength={150}
                  />
                </Field>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">What visitors see first</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field
                label="Page title"
                htmlFor="pageTitle"
                hint={`The name in big letters at the top of your page. Leave blank to use the program name. Example: "${program.name}"`}
              >
                <Input
                  id="pageTitle"
                  value={form.pageTitle}
                  onChange={(e) => set('pageTitle', e.target.value)}
                  placeholder={program.name}
                />
              </Field>
              <Field
                label="Headline"
                htmlFor="headline"
                hint='One sentence under the title that says what people get. Example: "Build a business that serves your community"'
              >
                <Input
                  id="headline"
                  value={form.headline}
                  onChange={(e) => set('headline', e.target.value)}
                  placeholder="Build a business that serves your community"
                />
              </Field>
              <Field
                label="About you"
                htmlFor="coachBio"
                hint="A short introduction. Required before you can submit."
              >
                <Textarea
                  id="coachBio"
                  rows={4}
                  value={form.coachBio}
                  onChange={(e) => set('coachBio', e.target.value)}
                />
              </Field>
              <Field
                label="Program description"
                htmlFor="programDescription"
                hint="What the program is and who it helps. Required before you can submit."
              >
                <Textarea
                  id="programDescription"
                  rows={6}
                  value={form.programDescription}
                  onChange={(e) => set('programDescription', e.target.value)}
                />
              </Field>
            </CardContent>
          </Card>
          <SaveBar onSave={saveContent} isPending={isPending} note="Names: the welcome email uses them at once. Everything else shows on your page after an admin approves." />
        </TabsContent>

        {/* ---- Videos ---- */}
        <TabsContent value="videos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">What people watch after signing up</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <p className="text-base text-gray-700">
                After signing up, visitors watch your video, then the NowTransformed video, and
                then choose <span className="font-medium text-gray-700">I&apos;m interested</span>{' '}
                to answer your questions. A step without a video is skipped.
              </p>
              <VideoField
                label="Your program video"
                htmlFor="coachVideoUrl"
                hint={`You explaining your program. ${VIDEO_LINK_HINT}`}
                value={form.coachVideoUrl}
                onChange={(v) => set('coachVideoUrl', v)}
              />
              <div className="pt-4 border-t border-gray-100 space-y-4">
                <VideoField
                  label="NowTransformed and sponsorship video"
                  htmlFor="ntVideoUrl"
                  hint={`Introduces NowTransformed and sponsored seats for this program. An admin may also set this for you. ${VIDEO_LINK_HINT}`}
                  value={form.ntVideoUrl}
                  onChange={(v) => set('ntVideoUrl', v)}
                />
                <Field
                  label="Text above the NowTransformed video"
                  htmlFor="ntVideoIntro"
                  hint="Optional. A line or two about NowTransformed sponsored seats. Don't promise a seat or a price: families who are a good fit may qualify."
                >
                  <Textarea
                    id="ntVideoIntro"
                    rows={3}
                    value={form.ntVideoIntro}
                    onChange={(e) => set('ntVideoIntro', e.target.value)}
                  />
                </Field>
              </div>
            </CardContent>
          </Card>
          <SaveBar onSave={saveContent} isPending={isPending} />
        </TabsContent>

        {/* ---- Event & Zoom ---- */}
        <TabsContent value="event" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Weekly meeting</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start justify-between gap-4 rounded-md border border-gray-200 p-3">
                <div>
                  <Label htmlFor="showMeetingDetails">Show the live meeting</Label>
                  <p className="text-sm text-gray-600 mt-0.5">
                    {showMeetingDetails
                      ? 'Your dates and joining link appear on your page.'
                      : 'Off: your program video takes the place of the live meeting. Dates and links are hidden, and your video is required before you can submit.'}
                  </p>
                </div>
                <Switch
                  id="showMeetingDetails"
                  checked={showMeetingDetails}
                  onCheckedChange={setShowMeetingDetails}
                />
              </div>
              <fieldset disabled={!showMeetingDetails} className="space-y-4 disabled:opacity-60">
              <Field
                label="Upcoming dates"
                htmlFor="eventDatesText"
                hint="One per line, in your own words. Required before you can submit."
              >
                <Textarea
                  id="eventDatesText"
                  rows={5}
                  value={form.eventDatesText}
                  onChange={(e) => set('eventDatesText', e.target.value)}
                  placeholder={'Thursday, March 12, 7pm ET\nThursday, March 19, 7pm ET'}
                />
              </Field>
              <Field
                label="Zoom link"
                htmlFor="zoomUrl"
                hint="Shown only after someone signs up. Required before you can submit."
              >
                <Input
                  id="zoomUrl"
                  type="url"
                  value={form.zoomUrl}
                  onChange={(e) => set('zoomUrl', e.target.value)}
                  placeholder="https://zoom.us/j/000000000"
                />
              </Field>
              <Field
                label="What to call it"
                htmlFor="zoomLabel"
                hint="Optional. Defaults to Zoom."
              >
                <Input
                  id="zoomLabel"
                  value={form.zoomLabel}
                  onChange={(e) => set('zoomLabel', e.target.value)}
                  placeholder="Zoom"
                />
              </Field>

              <div className="pt-4 mt-2 border-t border-gray-100">
                <p className="text-base font-semibold text-gray-900">Second meeting link</p>
                <p className="text-sm text-gray-600 mt-0.5 mb-3">
                  Optional. Add one if you also run the session on Google Meet, Teams or another
                  platform. Both links are shown to people who sign up.
                </p>
                <div className="space-y-4">
                  <Field label="Link" htmlFor="secondMeetingUrl">
                    <Input
                      id="secondMeetingUrl"
                      type="url"
                      value={form.secondMeetingUrl}
                      onChange={(e) => set('secondMeetingUrl', e.target.value)}
                      placeholder="https://meet.google.com/abc-defg-hij"
                    />
                  </Field>
                  <Field
                    label="What to call it"
                    htmlFor="secondMeetingLabel"
                    hint="Optional. Defaults to Second link."
                  >
                    <Input
                      id="secondMeetingLabel"
                      value={form.secondMeetingLabel}
                      onChange={(e) => set('secondMeetingLabel', e.target.value)}
                      placeholder="Google Meet"
                    />
                  </Field>
                </div>
              </div>

              <Field label="Joining instructions" htmlFor="zoomInstructions">
                <Textarea
                  id="zoomInstructions"
                  rows={3}
                  value={form.zoomInstructions}
                  onChange={(e) => set('zoomInstructions', e.target.value)}
                  placeholder="Dial in five minutes early. Passcode 1234."
                />
              </Field>
              </fieldset>
            </CardContent>
          </Card>
          <SaveBar onSave={saveContent} isPending={isPending} />
        </TabsContent>

        {/* ---- Questions ---- */}
        <TabsContent value="questions" className="space-y-4">
          {/* Hidden entirely when an admin has the standard questions switched
              off - the form then asks only what is below. */}
          {standardQuestions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Standard questions</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-base text-gray-700 mb-3">
                  Every program asks these. They cannot be edited or removed, so leads stay
                  comparable across coaches.
                </p>
                <ol className="space-y-2 text-base">
                  {standardQuestions.map((q, i) => (
                    <li key={q.id} className="flex gap-2 text-gray-700">
                      <span className="text-gray-400 tabular-nums">{i + 1}.</span>
                      <span>
                        {q.label}
                        <span className="text-gray-400"> · {QUESTION_TYPE_LABELS[q.type]}</span>
                        {q.required && <span className="text-red-500"> *</span>}
                      </span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Your questions ({questions.length}/{MAX_EXTRA_QUESTIONS})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Intro text above the form" htmlFor="qualificationIntro">
                <Textarea
                  id="qualificationIntro"
                  rows={2}
                  value={form.qualificationIntro}
                  onChange={(e) => set('qualificationIntro', e.target.value)}
                  placeholder="A few more questions so we can point you in the right direction."
                />
              </Field>

              {questions.length === 0 && (
                <p className="text-base text-gray-600">
                  No extra questions yet. Add one below to learn more about who is signing up.
                </p>
              )}

              {questions.map((q, index) => (
                <QuestionEditor
                  key={q.id}
                  question={q}
                  index={index}
                  onChange={(patch) => patchQuestion(q.id, patch)}
                  onRemove={() => setQuestions((prev) => prev.filter((x) => x.id !== q.id))}
                />
              ))}

              <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                {PROGRAM_QUESTION_TYPES.map((type) => (
                  <button key={type} type="button" className={kit.secondary} onClick={() => addQuestion(type)}>
                    <Plus className="h-4 w-4" aria-hidden />
                    {QUESTION_TYPE_LABELS[type]}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <SaveRule live={false} />
            <button type="button" className={`${kit.secondary} w-full sm:w-auto`} onClick={saveContent} disabled={isPending}>
              Save intro text
            </button>
            <button type="button" className={`${kit.primary} w-full sm:w-auto`} onClick={saveQuestions} disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Save questions
            </button>
          </div>
        </TabsContent>

        {/* ---- Program details (from the original program sheet) ---- */}
        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Program details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-base text-gray-700">
                These came from your original program sheet. You can change them; an admin approves
                the change before it appears publicly.
              </p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Target market" htmlFor="targetMarket">
                  <Input
                    id="targetMarket"
                    value={form.targetMarket}
                    onChange={(e) => set('targetMarket', e.target.value)}
                  />
                </Field>
                <Field label="Internship offering" htmlFor="internshipOffering">
                  <Input
                    id="internshipOffering"
                    value={form.internshipOffering}
                    onChange={(e) => set('internshipOffering', e.target.value)}
                  />
                </Field>
                <Field label="Weekly engagement 1" htmlFor="weeklyEngagement1">
                  <Input
                    id="weeklyEngagement1"
                    value={form.weeklyEngagement1}
                    onChange={(e) => set('weeklyEngagement1', e.target.value)}
                  />
                </Field>
                <Field label="Weekly engagement 2" htmlFor="weeklyEngagement2">
                  <Input
                    id="weeklyEngagement2"
                    value={form.weeklyEngagement2}
                    onChange={(e) => set('weeklyEngagement2', e.target.value)}
                  />
                </Field>
                <Field label="Monthly growth goal" htmlFor="monthlyGrowthGoal">
                  <Input
                    id="monthlyGrowthGoal"
                    value={form.monthlyGrowthGoal}
                    onChange={(e) => set('monthlyGrowthGoal', e.target.value)}
                  />
                </Field>
                <Field label="Monthly impact goal" htmlFor="monthlyImpactGoal">
                  <Input
                    id="monthlyImpactGoal"
                    value={form.monthlyImpactGoal}
                    onChange={(e) => set('monthlyImpactGoal', e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Description of services" htmlFor="servicesDescription">
                <Textarea
                  id="servicesDescription"
                  rows={3}
                  value={form.servicesDescription}
                  onChange={(e) => set('servicesDescription', e.target.value)}
                />
              </Field>
            </CardContent>
          </Card>
          <SaveBar onSave={saveContent} isPending={isPending} />
        </TabsContent>
        </fieldset>
      </Tabs>

    </div>
  )
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string
  htmlFor: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <Label htmlFor={htmlFor} className="text-base font-semibold text-gray-900">{label}</Label>
      {hint && <p className="text-sm text-gray-600 mt-0.5 mb-1.5">{hint}</p>}
      {children}
    </div>
  )
}

function VideoField({
  label,
  htmlFor,
  hint,
  value,
  onChange,
}: {
  label: string
  htmlFor: string
  hint: string
  value: string
  onChange: (value: string) => void
}) {
  const embedUrl = toVideoEmbedUrl(value)
  const invalid = value.trim() !== '' && embedUrl === null

  return (
    <Field label={label} htmlFor={htmlFor} hint={hint}>
      <Input
        id={htmlFor}
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://www.youtube.com/watch?v=..."
        aria-invalid={invalid}
      />
      {invalid && (
        <p className="text-sm text-red-700 mt-1">
          This link cannot be played on your page. {VIDEO_LINK_HINT}
        </p>
      )}
      {embedUrl && (
        <div className="relative mt-3 w-full max-w-md overflow-hidden rounded-md bg-black aspect-video">
          <iframe
            src={embedUrl}
            title={`${label} preview`}
            className="absolute inset-0 h-full w-full"
            allow="encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        </div>
      )}
    </Field>
  )
}

function SaveBar({ onSave, isPending, note }: { onSave: () => void; isPending: boolean; note?: string }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
      <SaveRule live={false}>{note}</SaveRule>
      <button type="button" className={`${kit.primary} w-full sm:w-auto`} onClick={onSave} disabled={isPending}>
        {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        Save changes
      </button>
    </div>
  )
}

function QuestionEditor({
  question,
  index,
  onChange,
  onRemove,
}: {
  question: ProgramQuestion
  index: number
  onChange: (patch: Partial<ProgramQuestion>) => void
  onRemove: () => void
}) {
  const isChoice = question.type === 'DROPDOWN' || question.type === 'RADIO'

  return (
    <div className="rounded-lg border border-gray-200 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-semibold text-gray-600 pt-2.5">
          Question {index + 1} · {QUESTION_TYPE_LABELS[question.type]}
        </span>
        <Button variant="ghost" onClick={onRemove} aria-label="Remove question" className="h-11 w-11 p-0">
          <Trash2 className="h-5 w-5 text-red-600" />
        </Button>
      </div>

      <Input
        value={question.label}
        onChange={(e) => onChange({ label: e.target.value })}
        placeholder="Question text"
        aria-label={`Question ${index + 1} text`}
      />

      {isChoice && (
        <div className="space-y-2">
          {(question.options ?? []).map((opt, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={opt}
                onChange={(e) => {
                  const next = [...(question.options ?? [])]
                  next[i] = e.target.value
                  onChange({ options: next })
                }}
                placeholder={`Option ${i + 1}`}
                aria-label={`Question ${index + 1} option ${i + 1}`}
              />
              <Button
                variant="ghost"
                className="h-11 w-11 flex-none p-0"
                onClick={() =>
                  onChange({ options: (question.options ?? []).filter((_, x) => x !== i) })
                }
                aria-label={`Remove option ${i + 1}`}
              >
                <Trash2 className="h-4 w-4 text-gray-500" />
              </Button>
            </div>
          ))}
          <button
            type="button"
            className={kit.secondary}
            onClick={() => onChange({ options: [...(question.options ?? []), ''] })}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add option
          </button>
        </div>
      )}

      {question.type === 'LIKERT' && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Input
            value={question.likert?.minLabel ?? ''}
            onChange={(e) =>
              onChange({
                likert: { ...(question.likert ?? DEFAULT_LIKERT), minLabel: e.target.value },
              })
            }
            placeholder="Label for the low end"
            aria-label={`Question ${index + 1} low label`}
          />
          <Input
            value={question.likert?.maxLabel ?? ''}
            onChange={(e) =>
              onChange({
                likert: { ...(question.likert ?? DEFAULT_LIKERT), maxLabel: e.target.value },
              })
            }
            placeholder="Label for the high end"
            aria-label={`Question ${index + 1} high label`}
          />
        </div>
      )}

      <div className="flex items-center gap-2">
        <Select
          value={question.required ? 'required' : 'optional'}
          onValueChange={(v) => onChange({ required: v === 'required' })}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="optional">Optional</SelectItem>
            <SelectItem value="required">Required</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
