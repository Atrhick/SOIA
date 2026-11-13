import type { CallOrigin } from '../call-data'

/**
 * "Where <first> came from" and the "Call guide" cards on the call record (admin and coach hosts).
 * Server component; no link to the prospect record (coach hosts can't open it).
 */
const card = 'bg-white border border-gray-200 rounded-xl p-5 min-w-0'

export function CallOriginCards({ o }: { o: CallOrigin }) {
  const first = o.firstName
  const rows: [string, string][] = [
    ['Invited by', o.inviter ? `${o.inviter.name} (${o.inviter.role})` : 'No inviter recorded'],
    ...(o.program ? [['Program', o.program] as [string, string]] : []),
    ...(o.program ? [['Sponsored seats', o.offer ? `${o.offer} (not shown to ${first})` : 'None for this program'] as [string, string]] : []),
    ['Channel', o.channel],
    ['Age', o.age],
    [`${first}'s time`, o.sameZone ? `${o.theirTime} (same as yours)` : `${o.theirTime} (yours: ${o.yourTime})`],
    ['Confirmed', o.confirmed],
  ]
  if (o.parent) {
    rows.push(['Parent or guardian', `${o.parent.name}${o.parent.attended === true ? ' · attended' : o.parent.attended === false ? ' · did not attend' : ' · attendance recorded after the call'}`])
  }
  const inviterFirst = o.inviter?.first

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <section aria-labelledby="origin-h" className={card}>
        <h2 id="origin-h" className="font-bold text-gray-900 mb-3">Where {first} came from</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-gray-600">{k}</dt>
              <dd className="font-semibold text-gray-900 break-words mb-1 sm:mb-0">{v}</dd>
            </div>
          ))}
        </dl>
        {o.helpWith && (
          <figure className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-4">
            <figcaption className="text-xs font-bold uppercase tracking-wide text-sky-900">{first} wrote</figcaption>
            <blockquote className="mt-1 text-[15px] text-gray-900 whitespace-pre-line break-words">&ldquo;{o.helpWith}&rdquo;</blockquote>
          </figure>
        )}
      </section>

      <section aria-labelledby="guide-h" className={card}>
        <h2 id="guide-h" className="font-bold text-gray-900 mb-3">Call guide</h2>
        <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-900">
          <li><strong>Open warm:</strong> {inviterFirst ? <>&quot;How do you know {inviterFirst}?&quot;</> : <>&quot;How did you hear about us?&quot;</>}</li>
          <li><strong>Listen first:</strong> {o.helpWith ? `ask about what ${first} wrote.` : `ask what ${first} would most like help with.`} Let {first} do most of the talking.</li>
          <li><strong>Explain the program in {first}&apos;s words:</strong> what happens each week.</li>
          <li>{o.hasOffer
            ? <><strong>Qualify first, then offer the sponsored seat if they&apos;re a good fit:</strong> {first} hasn&apos;t seen any prices. Use the Sponsored seat card (prices are shown to you only), say why NowTransformed sponsors it, then press &quot;Offer a sponsored seat&quot;.</>
            : <><strong>Cost:</strong> be clear about the price and what&apos;s included.</>}</li>
          <li><strong>Next step:</strong> agree it on the call. Record the outcome below.</li>
        </ol>
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">Describe what the program does. Don&apos;t promise health results.</p>
      </section>
    </div>
  )
}
