'use client'

import { useMemo, useState, useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AlertBanner } from '@/components/ui/alert-banner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CoreQuestionsClient, type CoreQuestionRow } from './core-questions-client'
import {
  Check,
  Copy,
  Eye,
  ExternalLink,
  Loader2,
  Megaphone,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import {
  approveProgram,
  assignProgramToCoach,
  adminUnpublishProgram,
  createProgram,
  deleteProgram,
  rejectProgram,
} from '@/lib/actions/program-pages'

interface ProgramRow {
  id: string
  slug: string
  name: string
  organization: string
  status: string
  coachId: string | null
  coachName: string | null
  isLive: boolean
  leadCount: number
  submittedAt: string | null
  reviewNotes: string | null
  programDescription: string | null
  coachBio: string | null
  eventDatesText: string | null
  zoomUrl: string | null
  extraQuestionCount: number
}

interface CoachOption {
  id: string
  name: string
}

const STATUS_META: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'destructive' | 'outline' }> = {
  DRAFT: { label: 'Draft', variant: 'outline' },
  PENDING_REVIEW: { label: 'Awaiting review', variant: 'warning' },
  PUBLISHED: { label: 'Published', variant: 'success' },
  REJECTED: { label: 'Sent back', variant: 'destructive' },
}

const UNASSIGNED = '__unassigned__'

export function ProgramsAdminClient({
  programs,
  coaches,
  coreQuestions,
}: {
  programs: ProgramRow[]
  coaches: CoachOption[]
  coreQuestions: CoreQuestionRow[]
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newOrg, setNewOrg] = useState('')

  const [reviewTarget, setReviewTarget] = useState<ProgramRow | null>(null)
  const [rejectTarget, setRejectTarget] = useState<ProgramRow | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<ProgramRow | null>(null)

  const pending = useMemo(() => programs.filter((p) => p.status === 'PENDING_REVIEW'), [programs])

  const run = (fn: () => Promise<{ error?: string; success?: boolean }>, okMessage: string) => {
    setError(null)
    setNotice(null)
    startTransition(async () => {
      const result = await fn()
      if (result?.error) setError(result.error)
      else setNotice(okMessage)
    })
  }

  const publicUrl = (slug: string) =>
    typeof window === 'undefined' ? `/p/${slug}` : `${window.location.origin}/p/${slug}`

  const copyLink = async (slug: string) => {
    try {
      await navigator.clipboard.writeText(publicUrl(slug))
      setCopiedSlug(slug)
      setTimeout(() => setCopiedSlug(null), 2000)
    } catch {
      setError('Could not copy to clipboard')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
          <Megaphone className="h-6 w-6 text-teal-600" />
          Program Pages
        </h1>
        <p className="text-gray-500 mt-1">
          Assign each program to its owning coach, then review and publish their public page.
        </p>
      </div>

      <Tabs defaultValue="programs">
        <TabsList>
          <TabsTrigger value="programs">Programs</TabsTrigger>
          <TabsTrigger value="questions">Standard questions</TabsTrigger>
        </TabsList>

        <TabsContent value="questions">
          <CoreQuestionsClient questions={coreQuestions} />
        </TabsContent>

        <TabsContent value="programs" className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Program
        </Button>
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

      {pending.length > 0 && (
        <Card className="border-yellow-300 bg-yellow-50">
          <CardHeader>
            <CardTitle className="text-base">
              {pending.length} program{pending.length === 1 ? '' : 's'} awaiting review
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pending.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-md bg-white border border-yellow-200 p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{p.name}</p>
                  <p className="text-sm text-gray-500 truncate">
                    {p.coachName ?? 'Unassigned'} · submitted{' '}
                    {p.submittedAt ? new Date(p.submittedAt).toLocaleDateString() : '-'}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setReviewTarget(p)}>
                  Review
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All programs ({programs.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Program</th>
                  <th className="px-4 py-3">Owning coach</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Leads</th>
                  <th className="px-4 py-3">Public link</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {programs.map((p) => {
                  const meta = STATUS_META[p.status] ?? { label: p.status, variant: 'outline' as const }
                  return (
                    <tr key={p.id} className="align-middle">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{p.name}</p>
                        <p className="text-gray-500">{p.organization}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Select
                          value={p.coachId ?? UNASSIGNED}
                          onValueChange={(value) =>
                            run(
                              () =>
                                assignProgramToCoach(
                                  p.id,
                                  value === UNASSIGNED ? null : value
                                ),
                              value === UNASSIGNED ? 'Program unassigned' : 'Coach assigned'
                            )
                          }
                          disabled={isPending}
                        >
                          <SelectTrigger className="w-[190px]">
                            <SelectValue placeholder="Assign a coach" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                            {coaches.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                      </td>
                      <td className="px-4 py-3 tabular-nums">{p.leadCount}</td>
                      <td className="px-4 py-3">
                        {p.isLive ? (
                          <div className="flex items-center gap-1">
                            <a
                              href={`/p/${p.slug}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary-600 hover:underline inline-flex items-center gap-1"
                            >
                              /p/{p.slug}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => copyLink(p.slug)}
                              aria-label={`Copy public link for ${p.name}`}
                            >
                              {copiedSlug === p.slug ? (
                                <Check className="h-3.5 w-3.5 text-green-600" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </div>
                        ) : (
                          <span className="text-gray-400">Not live</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {p.status === 'PENDING_REVIEW' && (
                          <Button size="sm" variant="outline" onClick={() => setReviewTarget(p)}>
                            Review
                          </Button>
                        )}
                        {p.status === 'PUBLISHED' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setRejectTarget(p)
                              setRejectReason('')
                            }}
                          >
                            Take down
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteTarget(p)}
                          aria-label={`Delete ${p.name}`}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>

      {/* Create program */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a program</DialogTitle>
            <DialogDescription>
              The public URL is generated from the program name and cannot be changed afterwards.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="new-program-name">Program name</Label>
              <Input
                id="new-program-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Community Wellness"
              />
            </div>
            <div>
              <Label htmlFor="new-program-org">Organization</Label>
              <Input
                id="new-program-org"
                value={newOrg}
                onChange={(e) => setNewOrg(e.target.value)}
                placeholder="Example Coaching LLC"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button
              disabled={isPending || !newName.trim() || !newOrg.trim()}
              onClick={() =>
                run(async () => {
                  const result = await createProgram({ name: newName, organization: newOrg })
                  if (!result?.error) {
                    setShowCreate(false)
                    setNewName('')
                    setNewOrg('')
                  }
                  return result
                }, 'Program created')
              }
            >
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review */}
      <Dialog open={reviewTarget !== null} onOpenChange={(open) => !open && setReviewTarget(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{reviewTarget?.name}</DialogTitle>
            <DialogDescription>
              Submitted by {reviewTarget?.coachName ?? 'an unassigned program'}. Approving publishes
              a snapshot of the current content to /p/{reviewTarget?.slug}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[50vh] overflow-y-auto text-sm">
            <ReviewField label="About the coach" value={reviewTarget?.coachBio} />
            <ReviewField label="Program description" value={reviewTarget?.programDescription} />
            <ReviewField label="Event dates" value={reviewTarget?.eventDatesText} />
            <ReviewField label="Zoom link" value={reviewTarget?.zoomUrl} />
            <p className="text-gray-500">
              {reviewTarget?.extraQuestionCount ?? 0} coach question
              {reviewTarget?.extraQuestionCount === 1 ? '' : 's'} in addition to the core set.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <a
              href={reviewTarget ? `/p/${reviewTarget.slug}?preview=1` : '#'}
              target="_blank"
              rel="noreferrer"
              className="mr-auto text-sm text-primary-600 hover:underline inline-flex items-center gap-1.5"
            >
              <Eye className="h-4 w-4" />
              Preview the page
            </a>
            <Button
              variant="outline"
              disabled={isPending}
              onClick={() => {
                setRejectTarget(reviewTarget)
                setRejectReason('')
                setReviewTarget(null)
              }}
            >
              <X className="h-4 w-4 mr-2" />
              Send back
            </Button>
            <Button
              disabled={isPending}
              onClick={() =>
                run(async () => {
                  const result = await approveProgram(reviewTarget!.id)
                  if (!result?.error) setReviewTarget(null)
                  return result
                }, 'Program published')
              }
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Approve and publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject / take down */}
      <Dialog open={rejectTarget !== null} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {rejectTarget?.status === 'PUBLISHED' ? 'Take down' : 'Send back'} {rejectTarget?.name}
            </DialogTitle>
            <DialogDescription>
              The coach sees this reason on their program. A reason is required.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={4}
            placeholder="What needs to change before this can go live?"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)} disabled={isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isPending || !rejectReason.trim()}
              onClick={() =>
                run(async () => {
                  const target = rejectTarget!
                  const result =
                    target.status === 'PUBLISHED'
                      ? await adminUnpublishProgram(target.id, rejectReason)
                      : await rejectProgram(target.id, rejectReason)
                  if (!result?.error) setRejectTarget(null)
                  return result
                }, 'Sent back to the coach')
              }
            >
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleteTarget?.name}?</DialogTitle>
            <DialogDescription>
              {deleteTarget && deleteTarget.leadCount > 0
                ? `This permanently deletes the program and its ${deleteTarget.leadCount} lead${
                    deleteTarget.leadCount === 1 ? '' : 's'
                  }. This cannot be undone.`
                : 'This permanently deletes the program. This cannot be undone.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={() =>
                run(async () => {
                  const result = await deleteProgram(deleteTarget!.id)
                  if (!result?.error) setDeleteTarget(null)
                  return result
                }, 'Program deleted')
              }
            >
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ReviewField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">{label}</p>
      <p className="whitespace-pre-wrap text-gray-800">
        {value?.trim() ? value : <span className="text-gray-400">Not provided</span>}
      </p>
    </div>
  )
}
