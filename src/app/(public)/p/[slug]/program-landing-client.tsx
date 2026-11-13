'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertBanner } from '@/components/ui/alert-banner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CalendarDays, Loader2, Plus, Trash2, Users } from 'lucide-react'
import { registerInterest } from '@/lib/actions/program-pages'
import {
  AGE_BAND_LABELS,
  AUDIENCE_LABELS,
  CHILD_AGE_BANDS,
  MAX_CHILDREN,
  PROGRAM_AUDIENCES,
  audienceIncludesChildren,
  type ChildAgeBand,
  type ProgramAudience,
} from '@/lib/program-question-types'
import { JourneyClient, type JourneyData } from './r/[token]/journey-client'

interface PublicProgram {
  slug: string
  name: string
  pageTitle: string
  organization: string
  headline: string | null
  coachBio: string | null
  programDescription: string | null
  targetMarket: string
  servicesDescription: string
  eventDatesText: string | null
  showMeetingDetails: boolean
  /** Who runs the program. First name only - the owner may be a youth ambassador. */
  owner?: { term: 'coach' | 'ambassador'; firstName: string | null }
}

interface ChildRow {
  firstName: string
  ageBand: ChildAgeBand | ''
}

const emptyChild = (): ChildRow => ({ firstName: '', ageBand: '' })

export function ProgramLandingClient({
  slug,
  program,
  previewJourney,
}: {
  slug: string
  program: PublicProgram
  /** Present only in preview: the draft journey to click through after
   *  "Continue", without creating a real lead. */
  previewJourney?: JourneyData
}) {
  const previewMode = previewJourney !== undefined
  const term = program.owner?.term ?? 'coach'
  const ownerFirstName = program.owner?.firstName?.trim() || null
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [alreadyRegistered, setAlreadyRegistered] = useState(false)
  const [showPreviewJourney, setShowPreviewJourney] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [profession, setProfession] = useState('')
  const [audience, setAudience] = useState<ProgramAudience | ''>('')
  const [children, setChildren] = useState<ChildRow[]>([emptyChild()])
  const [guardianConfirmed, setGuardianConfirmed] = useState(false)
  const [phone, setPhone] = useState('')
  // Honeypot: hidden from real users, so anything here means a bot.
  const [website, setWebsite] = useState('')

  const forChildren = audienceIncludesChildren(audience)

  const dates = program.showMeetingDetails
    ? (program.eventDatesText ?? '')
        .split('\n')
        .map((d) => d.trim())
        .filter(Boolean)
    : []

  const patchChild = (index: number, patch: Partial<ChildRow>) =>
    setChildren((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setAlreadyRegistered(false)

    if (!audience) {
      setError('Please tell us who this is for')
      return
    }

    if (previewMode) {
      setShowPreviewJourney(true)
      window.scrollTo({ top: 0 })
      return
    }

    startTransition(async () => {
      const result = await registerInterest(
        slug,
        {
          fullName,
          email,
          profession,
          audience,
          ...(forChildren ? { children, guardianConfirmed, phone } : { phone }),
        },
        website
      )
      if (result?.error) {
        setError(result.error)
        return
      }
      if (result?.token) {
        router.push(`/p/${slug}/r/${result.token}`)
        return
      }
      // No token comes back when this email is already registered. The link is
      // deliberately not re-issued here — anyone who knew the address could
      // otherwise retrieve someone else's private joining link.
      setAlreadyRegistered(true)
    })
  }

  if (previewJourney && showPreviewJourney) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setShowPreviewJourney(false)}
          className="text-sm text-primary-600 hover:underline"
        >
          Back to the landing page
        </button>
        <JourneyClient
          token={null}
          journey={previewJourney}
          lead={{
            firstName: fullName.split(/\s+/)[0] || 'there',
            audience: audience || 'SELF',
            children: children
              .filter((c) => c.firstName.trim() && c.ageBand)
              .map((c) => ({ firstName: c.firstName.trim(), ageBand: c.ageBand as ChildAgeBand })),
            interested: false,
            submitted: false,
          }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-sm uppercase tracking-wide text-primary-600 font-medium">
          {program.organization}
        </p>
        <h1 className="text-3xl font-bold text-gray-900 mt-2">
          {program.pageTitle || program.name}
        </h1>
        {ownerFirstName && (
          <p className="text-sm text-gray-500 mt-2">
            Hosted by {ownerFirstName}, NowTransformed{' '}
            {term === 'ambassador' ? 'Ambassador' : 'Coach'}
          </p>
        )}
        {program.headline && (
          <p className="text-lg text-gray-600 mt-3 max-w-2xl mx-auto">{program.headline}</p>
        )}
      </div>

      {program.programDescription && (
        <Card>
          <CardContent className="pt-6">
            <h2 className="font-semibold text-gray-900 mb-2">About this program</h2>
            <p className="whitespace-pre-wrap text-gray-700">{program.programDescription}</p>
            {program.targetMarket && (
              <p className="text-sm text-gray-500 mt-4 inline-flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                Who it is for: {program.targetMarket}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {program.coachBio && (
        <Card>
          <CardContent className="pt-6">
            <h2 className="font-semibold text-gray-900 mb-2">
              About your {term}
              {ownerFirstName ? `, ${ownerFirstName}` : ''}
            </h2>
            <p className="whitespace-pre-wrap text-gray-700">{program.coachBio}</p>
          </CardContent>
        </Card>
      )}

      {dates.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <h2 className="font-semibold text-gray-900 mb-3 inline-flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary-600" />
              Upcoming sessions
            </h2>
            <ul className="space-y-1.5">
              {dates.map((d, i) => (
                <li key={i} className="text-gray-700 flex gap-2">
                  <span className="text-primary-500">•</span>
                  {d}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card id="signup">
        <CardContent className="pt-6">
          <h2 className="font-semibold text-gray-900">Get started</h2>
          <p className="text-sm text-gray-500 mt-1 mb-4">
            Tell us who you are and we will take you to a short video from your {term}.
          </p>

          {error && <AlertBanner variant="error" message={error} className="mb-4" />}

          {alreadyRegistered && (
            <AlertBanner
              variant="info"
              title="You are already registered"
              message={`Open the link from when you first signed up — it is still valid. If you no longer have it, contact your ${term} and they can resend it.`}
              className="mb-4"
            />
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <fieldset>
              <legend className="text-sm font-medium text-gray-900 mb-2">
                Who are you exploring this program for?
              </legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {PROGRAM_AUDIENCES.map((a) => (
                  <label
                    key={a}
                    className={`flex items-center gap-2 rounded-md border px-3 py-2.5 cursor-pointer text-sm ${
                      audience === a
                        ? 'border-primary-500 bg-primary-50 text-primary-900'
                        : 'border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="audience"
                      value={a}
                      checked={audience === a}
                      onChange={() => setAudience(a)}
                    />
                    {AUDIENCE_LABELS[a]}
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <Label htmlFor="fullName">{forChildren ? 'Your full name (parent or guardian)' : 'Full name'}</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="name@example.com"
              />
            </div>
            <div>
              <Label htmlFor="profession">Profession</Label>
              <Input
                id="profession"
                value={profession}
                onChange={(e) => setProfession(e.target.value)}
                required
                autoComplete="organization-title"
              />
            </div>

            {forChildren && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">About your children</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Just a first name and age range. Everything else goes through you, and we
                    never contact your child directly.
                  </p>
                </div>

                {children.map((child, i) => (
                  <div key={i} className="flex gap-2 items-end">
                    <div className="flex-1 min-w-0">
                      <Label htmlFor={`child-name-${i}`}>First name</Label>
                      <Input
                        id={`child-name-${i}`}
                        value={child.firstName}
                        onChange={(e) => patchChild(i, { firstName: e.target.value })}
                        autoComplete="off"
                      />
                    </div>
                    <div className="w-36">
                      <Label htmlFor={`child-age-${i}`}>Age</Label>
                      <Select
                        value={child.ageBand}
                        onValueChange={(v) => patchChild(i, { ageBand: v as ChildAgeBand })}
                      >
                        <SelectTrigger id={`child-age-${i}`}>
                          <SelectValue placeholder="Choose" />
                        </SelectTrigger>
                        <SelectContent>
                          {CHILD_AGE_BANDS.map((b) => (
                            <SelectItem key={b} value={b}>
                              {AGE_BAND_LABELS[b]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {children.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setChildren((prev) => prev.filter((_, x) => x !== i))}
                        aria-label={`Remove child ${i + 1}`}
                      >
                        <Trash2 className="h-4 w-4 text-gray-400" />
                      </Button>
                    )}
                  </div>
                ))}

                {children.length < MAX_CHILDREN && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setChildren((prev) => [...prev, emptyChild()])}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Add another child
                  </Button>
                )}

                <div>
                  <Label htmlFor="phone">Your phone number (optional)</Label>
                  <p className="text-xs text-gray-500 mb-1">
                    So your {term} can call you to talk it through.
                  </p>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel"
                  />
                </div>

                <label className="flex items-start gap-2 cursor-pointer text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={guardianConfirmed}
                    onChange={(e) => setGuardianConfirmed(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    I am the parent or legal guardian of the children above, and I am happy for
                    the {term} to contact me about the program.
                  </span>
                </label>
              </div>
            )}

            {/* Honeypot - visually hidden and off the tab order. */}
            <div aria-hidden="true" className="absolute left-[-9999px] w-px h-px overflow-hidden">
              <label htmlFor="website-url">Leave this field empty</label>
              <input
                id="website-url"
                name="website-url"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {previewMode ? 'Continue (preview - nothing is saved)' : 'Continue'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
