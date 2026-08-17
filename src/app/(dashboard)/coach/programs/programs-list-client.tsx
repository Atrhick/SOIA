'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Check, Copy, ExternalLink, Megaphone, Users } from 'lucide-react'

interface ProgramRow {
  id: string
  slug: string
  name: string
  organization: string
  status: string
  reviewNotes: string | null
  isLive: boolean
  leadCount: number
  updatedAt: string
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

export function ProgramsListClient({ programs }: { programs: ProgramRow[] }) {
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null)

  const copyLink = async (slug: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/p/${slug}`)
      setCopiedSlug(slug)
      setTimeout(() => setCopiedSlug(null), 2000)
    } catch {
      /* clipboard unavailable - the link is visible on the page anyway */
    }
  }

  if (programs.length === 0) {
    return (
      <div className="space-y-6">
        <Header />
        <EmptyState
          icon={Megaphone}
          title="No programs assigned yet"
          description="An administrator assigns programs to your account. Once one is assigned it will appear here for you to set up."
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Header />
      <div className="grid gap-4 md:grid-cols-2">
        {programs.map((p) => {
          const meta = STATUS_META[p.status] ?? { label: p.status, variant: 'outline' as const }
          return (
            <Card key={p.id}>
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-semibold text-gray-900 truncate">{p.name}</h2>
                    <p className="text-sm text-gray-500 truncate">{p.organization}</p>
                  </div>
                  <Badge variant={meta.variant}>{meta.label}</Badge>
                </div>

                {p.status === 'REJECTED' && p.reviewNotes && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    <p className="font-medium mb-1">Changes requested</p>
                    <p className="whitespace-pre-wrap">{p.reviewNotes}</p>
                  </div>
                )}

                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {p.leadCount} lead{p.leadCount === 1 ? '' : 's'}
                  </span>
                  {p.isLive && (
                    <a
                      href={`/p/${p.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary-600 hover:underline"
                    >
                      View live page
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Link
                    href={`/coach/programs/${p.id}`}
                    className={buttonVariants({ size: 'sm' })}
                  >
                    Edit program
                  </Link>
                  {p.isLive && (
                    <Button size="sm" variant="outline" onClick={() => copyLink(p.slug)}>
                      {copiedSlug === p.slug ? (
                        <>
                          <Check className="h-3.5 w-3.5 mr-1.5 text-green-600" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5 mr-1.5" />
                          Copy link
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function Header() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
        <Megaphone className="h-6 w-6 text-teal-600" />
        Program Pages
      </h1>
      <p className="text-gray-500 mt-1">
        Your public invite pages. Edit the content, then submit for review — an administrator
        publishes it.
      </p>
    </div>
  )
}
