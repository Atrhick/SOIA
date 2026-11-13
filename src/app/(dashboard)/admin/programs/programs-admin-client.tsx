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
  SelectGroup,
  SelectItem,
  SelectLabel,
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
  Film,
  Loader2,
  Megaphone,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import {
  approveProgram,
  assignProgramOwner,
  adminUnpublishProgram,
  createProgram,
  deleteProgram,
  rejectProgram,
  setProgramNtVideo,
} from '@/lib/actions/program-pages'
import { toVideoEmbedUrl, VIDEO_LINK_HINT } from '@/lib/video-embed'
import {
  UNASSIGNED_OWNER,
  encodeOwnerChoice,
  type ProgramOwnerRole,
} from '@/lib/program-owner'

interface ProgramRow {
  id: string
  slug: string
  name: string
  organization: string
  status: string
  coachId: string | null
  ambassadorId: string | null
  ownerRole: ProgramOwnerRole | null
  ownerName: string | null
  isLive: boolean
  leadCount: number
  submittedAt: string | null
  reviewNotes: string | null
  programDescription: string | null
  coachBio: string | null
  eventDatesText: string | null
  zoomUrl: string | null
  showMeetingDetails: boolean
  coachVideoUrl: string | null
  ntVideoUrl: string | null
  ntVideoIntro: string | null
  extraQuestionCount: number
}

interface OwnerOption {
  id: string
  name: string
}

const ROLE_TAG: Record<ProgramOwnerRole, { label: string; className: string }> = {
  COACH: { label: 'Coach', className: 'bg-blue-100 text-blue-800' },
  AMBASSADOR: { label: 'Ambassador', className: 'bg-amber-100 text-amber-800' },
}

function RoleTag({ role }: { role: ProgramOwnerRole }) {
  const tag = ROLE_TAG[role]
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium ${tag.className}`}>
      {tag.label}
    </span>
  )
}

function OwnerLabel({ program }: { program: ProgramRow }) {
  if (!program.ownerRole || !program.ownerName) return <>Unassigned</>
  return (
    <span className="inline-flex items-center gap-1.5">
      {program.ownerName}
      <RoleTag role={program.ownerRole} />
    </span>
  )
}

/** "coach" / "ambassador", for review wording. */
function ownerNoun(program: ProgramRow | null): 'coach' | 'ambassador' {
  return program?.ownerRole === 'AMBASSADOR' ? 'ambassador' : 'coach'
}

const STATUS_META: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'destructive' | 'outline' }> = {
  DRAFT: { label: 'Draft', variant: 'outline' },
  PENDING_REVIEW: { label: 'Awaiting review', variant: 'warning' },
  PUBLISHED: { label: 'Published', variant: 'success' },
  REJECTED: { label: 'Sent back', variant: 'destructive' },
}

export function ProgramsAdminClient({
  programs,
  coaches,
  ambassadors,
  coreQuestions,
  standardQuestionsEnabled,
}: {
  programs: ProgramRow[]
  coaches: OwnerOption[]
  ambassadors: OwnerOption[]
  coreQuestions: CoreQuestionRow[]
  standardQuestionsEnabled: boolean
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
  const [videoTarget, setVideoTarget] = useState<ProgramRow | null>(null)
  const [ntVideoUrl, setNtVideoUrl] = useState('')
  const [ntVideoIntro, setNtVideoIntro] = useState('')
  const ntVideoInvalid = ntVideoUrl.trim() !== '' && toVideoEmbedUrl(ntVideoUrl) === null

  const openVideo = (p: ProgramRow) => {
    setVideoTarget(p)
    setNtVideoUrl(p.ntVideoUrl ?? '')
    setNtVideoIntro(p.ntVideoIntro ?? '')
  }

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
          Assign each program to its owning coach or ambassador, then review and publish their
          public page.
        </p>
      </div>

      <Tabs defaultValue="programs">
        <TabsList>
          <TabsTrigger value="programs">Programs</TabsTrigger>
          <TabsTrigger value="questions">
            Standard questions
            {!standardQuestionsEnabled && (
              <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600">
                Off
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="questions">
          <CoreQuestionsClient questions={coreQuestions} enabled={standardQuestionsEnabled} />
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
                    <OwnerLabel program={p} /> · submitted{' '}
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
          <div className="md:overflow-x-auto">
            <table className="block w-full text-sm md:table">
              <thead className="hidden bg-gray-50 text-left md:table-header-group text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Program</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Leads</th>
                  <th className="px-4 py-3">Public link</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="block divide-y divide-gray-100 md:table-row-group">
                {programs.map((p) => {
                  const meta = STATUS_META[p.status] ?? { label: p.status, variant: 'outline' as const }
                  return (
                    <tr key={p.id} className="block space-y-3 p-4 align-middle md:table-row md:space-y-0 md:p-0">
                      <td className="block md:table-cell md:px-4 md:py-3">
                        <p className="text-base font-semibold text-gray-900 md:text-sm md:font-medium">{p.name}</p>
                        <p className="text-gray-500">{p.organization}</p>
                      </td>
                      <td className="block md:table-cell md:px-4 md:py-3">
                        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 md:hidden">Owner</span>
                        <Select
                          value={encodeOwnerChoice(p)}
                          onValueChange={(value) =>
                            run(
                              () => assignProgramOwner(p.id, value),
                              value === UNASSIGNED_OWNER
                                ? 'Program unassigned'
                                : value.startsWith('AMBASSADOR:')
                                  ? 'Ambassador assigned'
                                  : 'Coach assigned'
                            )
                          }
                          disabled={isPending}
                        >
                          <SelectTrigger className="w-full md:w-[220px]" aria-label={`Owner of ${p.name}`}>
                            <SelectValue placeholder="Assign an owner" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={UNASSIGNED_OWNER}>Unassigned</SelectItem>
                            {coaches.length > 0 && (
                              <SelectGroup>
                                <SelectLabel>Coaches</SelectLabel>
                                {coaches.map((c) => (
                                  <SelectItem key={c.id} value={`COACH:${c.id}`}>
                                    {c.name}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            )}
                            {ambassadors.length > 0 && (
                              <SelectGroup>
                                <SelectLabel>Ambassadors</SelectLabel>
                                {ambassadors.map((a) => (
                                  <SelectItem key={a.id} value={`AMBASSADOR:${a.id}`}>
                                    {a.name}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            )}
                          </SelectContent>
                        </Select>
                        {p.ownerRole && (
                          <div className="mt-1">
                            <RoleTag role={p.ownerRole} />
                          </div>
                        )}
                      </td>
                      <td className="inline-block md:table-cell md:px-4 md:py-3">
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                      </td>
                      <td className="ml-3 inline-block tabular-nums text-gray-700 md:ml-0 md:table-cell md:px-4 md:py-3 md:text-gray-900">{p.leadCount}<span className="md:hidden"> {p.leadCount === 1 ? 'lead' : 'leads'}</span></td>
                      <td className="block min-w-0 md:table-cell md:px-4 md:py-3">
                        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 md:hidden">Public link</span>
                        {p.isLive ? (
                          <div className="flex items-center gap-1">
                            <a
                              href={`/p/${p.slug}`}
                              title={`/p/${p.slug}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary-600 hover:underline inline-flex min-w-0 items-center gap-1 break-all"
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
                      <td className="-mx-2 flex flex-wrap items-center gap-1 md:mx-0 md:table-cell md:whitespace-nowrap md:px-4 md:py-3 md:text-right">
                        {p.status === 'PENDING_REVIEW' && (
                          <Button size="sm" variant="outline" onClick={() => setReviewTarget(p)}>
                            Review
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openVideo(p)}
                          title="Set the NowTransformed and sponsorship video"
                        >
                          <Film className="h-4 w-4 mr-1.5" />
                          NT video
                          {p.ntVideoUrl && <Check className="h-3.5 w-3.5 ml-1 text-green-600" />}
                        </Button>
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
              Submitted by{' '}
              {reviewTarget?.ownerName
                ? `${reviewTarget.ownerName} (${ownerNoun(reviewTarget)})`
                : 'an unassigned program'}
              . Approving publishes
              a snapshot of the current content to /p/{reviewTarget?.slug}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[50vh] overflow-y-auto text-sm">
            <ReviewField
              label={`About the ${ownerNoun(reviewTarget)}`}
              value={reviewTarget?.coachBio}
            />
            <ReviewField label="Program description" value={reviewTarget?.programDescription} />
            <ReviewVideo
              label={
                ownerNoun(reviewTarget) === 'ambassador'
                  ? "Ambassador's program video"
                  : "Coach's program video"
              }
              url={reviewTarget?.coachVideoUrl}
            />
            <ReviewVideo
              label="NowTransformed and sponsorship video"
              url={reviewTarget?.ntVideoUrl}
            />
            <ReviewField label="Text above the NT video" value={reviewTarget?.ntVideoIntro} />
            {reviewTarget?.showMeetingDetails ? (
              <>
                <ReviewField label="Event dates" value={reviewTarget?.eventDatesText} />
                <ReviewField label="Zoom link" value={reviewTarget?.zoomUrl} />
              </>
            ) : (
              <p className="text-gray-500">
                Live meeting switched off: the {ownerNoun(reviewTarget)}&apos;s video replaces it.
              </p>
            )}
            <p className="text-gray-500">
              {reviewTarget?.extraQuestionCount ?? 0} {ownerNoun(reviewTarget)} question
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
              The {ownerNoun(rejectTarget)} sees this reason on their program. A reason is
              required.
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
                }, `Sent back to the ${ownerNoun(rejectTarget)}`)
              }
            >
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* NowTransformed / sponsorship video */}
      <Dialog open={videoTarget !== null} onOpenChange={(open) => !open && setVideoTarget(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>NowTransformed video for {videoTarget?.name}</DialogTitle>
            <DialogDescription>
              {videoTarget?.isLive
                ? 'This page is live, so saving updates the public page straight away. The coach’s own unapproved edits are not published.'
                : 'Saved to the program. It goes live when the page is next approved.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="nt-video-url">Video link</Label>
              <Input
                id="nt-video-url"
                type="url"
                value={ntVideoUrl}
                onChange={(e) => setNtVideoUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                aria-invalid={ntVideoInvalid}
              />
              <p className={`text-xs mt-1 ${ntVideoInvalid ? 'text-red-600' : 'text-gray-500'}`}>
                {ntVideoInvalid ? 'This link cannot be embedded. ' : ''}
                {VIDEO_LINK_HINT} Leave empty to remove the video.
              </p>
            </div>
            <div>
              <Label htmlFor="nt-video-intro">Text above the video (optional)</Label>
              <Textarea
                id="nt-video-intro"
                rows={3}
                value={ntVideoIntro}
                onChange={(e) => setNtVideoIntro(e.target.value)}
                placeholder="The sponsorship opportunities available through this program."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVideoTarget(null)} disabled={isPending}>
              Cancel
            </Button>
            <Button
              disabled={isPending || ntVideoInvalid}
              onClick={() =>
                run(async () => {
                  const result = await setProgramNtVideo(videoTarget!.id, {
                    ntVideoUrl,
                    ntVideoIntro,
                  })
                  if (!result?.error) setVideoTarget(null)
                  return result
                }, 'NowTransformed video saved')
              }
            >
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
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

function ReviewVideo({ label, url }: { label: string; url?: string | null }) {
  const embedUrl = toVideoEmbedUrl(url)
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">{label}</p>
      {embedUrl ? (
        <div className="relative w-full max-w-md overflow-hidden rounded-md bg-black aspect-video">
          <iframe
            src={embedUrl}
            title={label}
            className="absolute inset-0 h-full w-full"
            allow="encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        </div>
      ) : (
        <p className="text-gray-400">Not provided - this step is skipped</p>
      )}
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
