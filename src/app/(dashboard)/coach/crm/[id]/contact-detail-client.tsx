'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { Card, CardContent } from '@/components/ui/card'
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
import { ArrowLeft, Clock, Loader2, Mail, MessageSquare, Phone, Users, Video } from 'lucide-react'
import {
  logActivity,
  setContactAssociation,
  setNextFollowUp,
  updateContactNotes,
  updateContactStatus,
} from '@/lib/actions/crm'

interface Answer {
  questionId: string
  label: string
  type: string
  value: string | number
}

interface Contact {
  id: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  company: string | null
  jobTitle: string | null
  notes: string | null
  source: string
  status: string
  createdAt: string
  lastContactedAt: string | null
  nextFollowUpAt: string | null
  lead: {
    programName: string
    programSlug: string
    registeredAt: string
    qualifiedAt: string | null
    association: string
    coachNotes: string | null
    answers: Answer[]
  } | null
}

interface Activity {
  id: string
  type: string
  title: string
  description: string | null
  createdAt: string
}

const STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'DORMANT', 'LOST']
const STATUS_LABELS: Record<string, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  QUALIFIED: 'Qualified',
  CONVERTED: 'Converted',
  DORMANT: 'Dormant',
  LOST: 'Lost',
}

const ASSOCIATIONS = [
  { value: 'UNCLASSIFIED', label: 'Unclassified' },
  { value: 'AMBASSADOR', label: 'Prospective Ambassador' },
  { value: 'COACH', label: 'Prospective Coach' },
  { value: 'SERVICE_PROVIDER', label: 'Service Provider' },
  { value: 'BUSINESS_AFFILIATE', label: 'Business Affiliate' },
  { value: 'VOLUNTEER', label: 'Volunteer' },
]

const ACTIVITY_ICONS: Record<string, typeof Phone> = {
  CALL: Phone,
  EMAIL: Mail,
  MEETING: Video,
  NOTE: MessageSquare,
  TASK: Clock,
}

export function ContactDetailClient({
  contact,
  activities,
}: {
  contact: Contact
  activities: Activity[]
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [logType, setLogType] = useState('CALL')
  const [logTitle, setLogTitle] = useState('')
  const [logDetail, setLogDetail] = useState('')
  const [followUp, setFollowUp] = useState(contact.nextFollowUpAt?.slice(0, 10) ?? '')
  const [notes, setNotes] = useState(contact.notes ?? '')

  const run = (fn: () => Promise<{ error?: string; success?: boolean }>, ok: string) => {
    setError(null)
    setNotice(null)
    startTransition(async () => {
      const result = await fn()
      if (result?.error) setError(result.error)
      else setNotice(ok)
    })
  }

  return (
    <div className="space-y-6">
      <Link
        href="/coach/crm"
        className="text-sm text-gray-500 hover:text-gray-800 inline-flex items-center gap-1"
      >
        <ArrowLeft className="h-4 w-4" />
        All contacts
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {contact.firstName} {contact.lastName}
          </h1>
          <p className="text-gray-500 mt-1">
            {[contact.jobTitle, contact.email, contact.phone].filter(Boolean).join(' · ') || '—'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={contact.status}
            onValueChange={(v) => run(() => updateContactStatus(contact.id, v), 'Status updated')}
            disabled={isPending}
          >
            <SelectTrigger className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <AlertBanner variant="error" message={error} dismissible onDismiss={() => setError(null)} />
      )}
      {notice && (
        <AlertBanner
          variant="success"
          message={notice}
          dismissible
          onDismiss={() => setNotice(null)}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* What they told you - the reason the qualification form exists */}
          {contact.lead && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                  <h2 className="font-semibold text-gray-900">What they told you</h2>
                  <Badge variant={contact.lead.qualifiedAt ? 'success' : 'warning'}>
                    {contact.lead.qualifiedAt ? 'Form completed' : 'Form not completed'}
                  </Badge>
                </div>

                {contact.lead.answers.length === 0 ? (
                  <p className="text-gray-500 text-sm">
                    They signed up but have not completed the qualification form yet. The joining
                    link still works, so they can complete it at any time.
                  </p>
                ) : (
                  <dl className="space-y-4">
                    {contact.lead.answers.map((a, i) => (
                      <div key={i}>
                        <dt className="text-xs uppercase tracking-wide text-gray-500">{a.label}</dt>
                        <dd className="text-gray-800 whitespace-pre-wrap mt-0.5">
                          {String(a.value)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </CardContent>
            </Card>
          )}

          {/* Activity timeline */}
          <Card>
            <CardContent className="pt-6">
              <h2 className="font-semibold text-gray-900 mb-4">History</h2>

              <div className="space-y-3 mb-6 pb-6 border-b border-gray-100">
                <div className="grid gap-3 sm:grid-cols-[150px_1fr]">
                  <Select value={logType} onValueChange={setLogType}>
                    <SelectTrigger aria-label="Interaction type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CALL">Call</SelectItem>
                      <SelectItem value="EMAIL">Email</SelectItem>
                      <SelectItem value="MEETING">Meeting</SelectItem>
                      <SelectItem value="NOTE">Note</SelectItem>
                      <SelectItem value="TASK">Task</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={logTitle}
                    onChange={(e) => setLogTitle(e.target.value)}
                    placeholder="What happened?"
                    aria-label="What happened"
                  />
                </div>
                <Textarea
                  value={logDetail}
                  onChange={(e) => setLogDetail(e.target.value)}
                  rows={2}
                  placeholder="Any detail worth remembering (optional)"
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    disabled={isPending || !logTitle.trim()}
                    onClick={() =>
                      run(async () => {
                        const r = await logActivity(contact.id, {
                          type: logType,
                          title: logTitle,
                          description: logDetail || undefined,
                        })
                        if (!r?.error) {
                          setLogTitle('')
                          setLogDetail('')
                        }
                        return r
                      }, 'Logged')
                    }
                  >
                    {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Log it
                  </Button>
                </div>
              </div>

              {activities.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Nothing logged yet. Record calls and emails here so the history stays with the
                  person.
                </p>
              ) : (
                <ul className="space-y-4">
                  {activities.map((a) => {
                    const Icon = ACTIVITY_ICONS[a.type] ?? MessageSquare
                    return (
                      <li key={a.id} className="flex gap-3">
                        <div className="p-1.5 bg-gray-100 rounded-md h-fit">
                          <Icon className="h-4 w-4 text-gray-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-gray-900">{a.title}</p>
                          {a.description && (
                            <p className="text-sm text-gray-600 whitespace-pre-wrap mt-0.5">
                              {a.description}
                            </p>
                          )}
                          <p className="text-xs text-gray-400 mt-0.5">
                            {a.type.toLowerCase()} · {new Date(a.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h2 className="font-semibold text-gray-900">Next step</h2>
              <div>
                <Label htmlFor="followup">Follow up on</Label>
                <Input
                  id="followup"
                  type="date"
                  value={followUp}
                  onChange={(e) => setFollowUp(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={isPending}
                  onClick={() =>
                    run(
                      () => setNextFollowUp(contact.id, followUp ? `${followUp}T09:00:00.000Z` : null),
                      followUp ? 'Follow-up set' : 'Follow-up cleared'
                    )
                  }
                >
                  Save
                </Button>
                {contact.nextFollowUpAt && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => {
                      setFollowUp('')
                      run(() => setNextFollowUp(contact.id, null), 'Follow-up cleared')
                    }}
                  >
                    Clear
                  </Button>
                )}
              </div>
              <p className="text-xs text-gray-500">
                Last contacted:{' '}
                {contact.lastContactedAt
                  ? new Date(contact.lastContactedAt).toLocaleDateString()
                  : 'never'}
              </p>
            </CardContent>
          </Card>

          {contact.lead && (
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="font-semibold text-gray-900 inline-flex items-center gap-2">
                  <Users className="h-4 w-4 text-gray-400" />
                  Classification
                </h2>
                <Select
                  value={contact.lead.association}
                  onValueChange={(v) =>
                    run(() => setContactAssociation(contact.id, v), 'Classification saved')
                  }
                  disabled={isPending}
                >
                  <SelectTrigger aria-label="Association type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSOCIATIONS.map((a) => (
                      <SelectItem key={a.value} value={a.value}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="text-xs text-gray-500 space-y-1 pt-2 border-t border-gray-100">
                  <p>From: {contact.lead.programName}</p>
                  <p>Signed up: {new Date(contact.lead.registeredAt).toLocaleDateString()}</p>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="font-semibold text-gray-900">Private notes</h2>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={5}
                placeholder="Only you see this."
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => run(() => updateContactNotes(contact.id, notes), 'Notes saved')}
                >
                  Save notes
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
