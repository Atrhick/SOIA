'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertBanner } from '@/components/ui/alert-banner'
import { CalendarDays, Loader2, Users } from 'lucide-react'
import { registerInterest } from '@/lib/actions/program-pages'

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
}

export function ProgramLandingClient({
  slug,
  program,
  previewMode = false,
}: {
  slug: string
  program: PublicProgram
  /** Rendered from draft content for the coach/admin. Signup is disabled so a
   *  preview never creates a real lead. */
  previewMode?: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [alreadyRegistered, setAlreadyRegistered] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [profession, setProfession] = useState('')
  // Honeypot: hidden from real users, so anything here means a bot.
  const [website, setWebsite] = useState('')

  const dates = (program.eventDatesText ?? '')
    .split('\n')
    .map((d) => d.trim())
    .filter(Boolean)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (previewMode) return
    setError(null)
    setAlreadyRegistered(false)
    startTransition(async () => {
      const result = await registerInterest(
        slug,
        { fullName, email, profession },
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

  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-sm uppercase tracking-wide text-primary-600 font-medium">
          {program.organization}
        </p>
        <h1 className="text-3xl font-bold text-gray-900 mt-2">
          {program.pageTitle || program.name}
        </h1>
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
            <h2 className="font-semibold text-gray-900 mb-2">About your coach</h2>
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
          <h2 className="font-semibold text-gray-900">Get the meeting link</h2>
          <p className="text-sm text-gray-500 mt-1 mb-4">
            Tell us who you are and we will take you straight to the joining details.
          </p>

          {error && <AlertBanner variant="error" message={error} className="mb-4" />}

          {alreadyRegistered && (
            <AlertBanner
              variant="info"
              title="You are already registered"
              message="Open the joining link from when you first signed up — it is still valid. If you no longer have it, contact your coach and they can resend it."
              className="mb-4"
            />
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <Label htmlFor="fullName">Full name</Label>
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

            <Button type="submit" className="w-full" disabled={isPending || previewMode}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {previewMode ? 'Continue (disabled in preview)' : 'Continue'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
