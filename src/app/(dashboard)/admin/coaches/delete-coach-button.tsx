'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, Trash2 } from 'lucide-react'
import { deleteCoach, getCoachDeletionImpact } from '@/lib/actions/coaches'

interface Impact {
  name: string
  email: string
  ambassadors: number
  contacts: number
  programs: string[]
}

/**
 * Deleting a coach is irreversible and takes their ambassadors with it, so the
 * confirmation states exactly what goes and what survives, and requires the
 * name to be typed rather than a single click.
 */
export function DeleteCoachButton({ coachId, name }: { coachId: string; name: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [impact, setImpact] = useState<Impact | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const openDialog = () => {
    setError(null)
    setConfirmText('')
    setImpact(null)
    setOpen(true)
    startTransition(async () => {
      const result = await getCoachDeletionImpact(coachId)
      if ('error' in result) setError(result.error ?? 'Could not load the details')
      else setImpact(result.impact)
    })
  }

  const confirm = () => {
    setError(null)
    startTransition(async () => {
      const result = await deleteCoach(coachId)
      if (result?.error) {
        setError(result.error)
        return
      }
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          openDialog()
        }}
        className="p-2 rounded-md text-gray-300 hover:text-red-600 hover:bg-red-50 transition-colors"
        aria-label={`Delete ${name}`}
        title={`Delete ${name}`}
      >
        <Trash2 className="h-4 w-4" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {impact?.name ?? name}?</DialogTitle>
            <DialogDescription>
              This removes their login permanently and cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {!impact && !error ? (
            <p className="text-sm text-gray-500 py-4">Checking what this would remove…</p>
          ) : impact ? (
            <div className="space-y-4 text-sm">
              <div>
                <p className="font-medium text-gray-900 mb-1">Permanently deleted</p>
                <ul className="text-gray-600 space-y-0.5 list-disc list-inside">
                  <li>Their login ({impact.email}) and coach profile</li>
                  <li>
                    {impact.ambassadors} ambassador{impact.ambassadors === 1 ? '' : 's'} under them
                  </li>
                  <li>
                    {impact.contacts} CRM contact{impact.contacts === 1 ? '' : 's'} and their history
                  </li>
                  <li>Their goals, income entries and onboarding progress</li>
                </ul>
              </div>

              <div>
                <p className="font-medium text-gray-900 mb-1">Kept, but unassigned</p>
                {impact.programs.length > 0 ? (
                  <ul className="text-gray-600 space-y-0.5 list-disc list-inside">
                    {impact.programs.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500">No programs assigned to them.</p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Program pages survive and return to unassigned, so they can be given to someone
                  else. Any leads already captured go with the contacts above.
                </p>
              </div>

              <div className="pt-2 border-t border-gray-100">
                <Label htmlFor="confirm-name">
                  Type <span className="font-mono font-medium">{impact.name}</span> to confirm
                </Label>
                <Input
                  id="confirm-name"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  autoComplete="off"
                />
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isPending || !impact || confirmText.trim() !== impact.name}
              onClick={confirm}
            >
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
