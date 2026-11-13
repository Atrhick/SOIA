import { CheckCircle2, Clock } from 'lucide-react'

/** Next to a save button: whether this save goes live at once or waits for an admin's review. */
export function SaveRule({ live, children }: { live: boolean; children?: React.ReactNode }) {
  return (
    <p className={`flex items-start gap-1.5 text-sm ${live ? 'text-green-800' : 'text-amber-800'}`}>
      {live ? <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none" aria-hidden /> : <Clock className="mt-0.5 h-4 w-4 flex-none" aria-hidden />}
      <span><strong>{live ? 'Goes live now.' : 'Needs review.'}</strong> {children ?? (live ? 'No review needed.' : 'An admin approves it after you submit for review.')}</span>
    </p>
  )
}
