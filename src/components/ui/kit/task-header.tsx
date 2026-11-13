/**
 * Page header that says what to do here, in one line. Every One-A-Day page starts with it.
 *   <TaskHeader title="Invite someone today" doThis="Email an invite, or copy a message to send yourself." />
 */
export function TaskHeader({ title, doThis, aside }: { title: string; doThis: string; aside?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold leading-tight text-gray-900 sm:text-3xl">{title}</h1>
        <p className="mt-1 text-base text-gray-700">{doThis}</p>
      </div>
      {aside}
    </div>
  )
}
