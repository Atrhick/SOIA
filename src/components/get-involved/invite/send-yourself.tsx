'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Lock, Loader2, RotateCcw } from 'lucide-react'
import { kit } from '@/components/ui/kit/styles'
import { useToast } from '@/components/ui/kit/toast'
import { recordShare } from '@/lib/actions/outreach-share'
import { disclosureLine, shareLinkFor } from '@/lib/get-involved/outreach-templates'
import { emailFooter, hasBlank, renderScript, visibleScenarios, type Scenario, type ScriptVariant } from '@/lib/get-involved/scripts'
import type { InviteProgramOption } from '@/components/get-involved/share-kit/data'
import { ideasFor } from '@/lib/get-involved/line-ideas'
import { LineIdeasPicker } from './line-ideas-picker'
import { HOW, PERSONAL_EXAMPLES, channelFor, copyText, openAfterCopy, openTarget, pasteWhere, variantFor, type HowKey } from './shared'

const NEEDS_PERSONAL = ['KNOW', 'INTRO', 'GROUP', 'PARENT']
const NAME_PLACEHOLDER = '[first name]'

type Field = 'name' | 'personal' | 'message'

/**
 * "Copy a message or link" (mode 'first') and "They said yes: send the link" (mode 'yes').
 * Who is it for? -> How will you send it? -> the message, already filled, with one "Copy and open" button,
 * then "Did you send it?" which logs it (keeps the day and puts them on Follow-ups).
 */
export function SendYourself(props: {
  mode: 'first' | 'yes'
  role: 'COACH' | 'AMBASSADOR'
  program: InviteProgramOption
  myFirstName: string
  minor: boolean
  mailingAddress: string
}) {
  const { program, mode } = props
  const router = useRouter()
  const toast = useToast()
  const [scenario, setScenario] = useState<string | null>(mode === 'yes' ? 'YES' : null)
  const [how, setHow] = useState<HowKey | null>(null)
  const [name, setName] = useState('')
  const [personal, setPersonal] = useState('')
  const [custom, setCustom] = useState<{ subject: string; body: string } | null>(null)
  const [err, setErr] = useState<{ field: Field; text: string } | null>(null)
  const [ask, setAsk] = useState<{ channel: string; firstName: string | null } | null>(null)
  const [busy, setBusy] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const personalRef = useRef<HTMLTextAreaElement>(null)
  const messageRef = useRef<HTMLTextAreaElement>(null)

  const scenarios: Scenario[] = useMemo(
    () => visibleScenarios({ owns: program.owns, minor: props.minor }).filter((s) => s.group === 'FIRST' && s.variants.some((v) => !!program.scripts[`${s.key}:${v}` as keyof typeof program.scripts])),
    [program, props.minor],
  )
  const current = scenario ? scenarios.find((s) => s.key === scenario) ?? null : null
  const isPost = scenario === 'POST'
  const variant: ScriptVariant = isPost ? 'POST' : how ? (mode === 'yes' ? 'SHORT' : variantFor(how)) : 'SHORT'
  const ready = !!scenario && (isPost || !!how)

  // A new situation, way of sending or program starts again from the program's message.
  useEffect(() => { setCustom(null); setErr(null) }, [scenario, how, program.id])
  useEffect(() => { if (mode === 'yes') setScenario('YES') }, [mode])

  const script = scenario
    ? program.scripts[`${scenario}:${variant}` as keyof typeof program.scripts] ?? program.scripts[`${scenario}:SHORT` as keyof typeof program.scripts] ?? null
    : null
  const channel = how || isPost ? channelFor(how ?? 'TEXT', scenario ?? '') : 'TEXT'
  const link = shareLinkFor(program.url, channel)
  const values = { firstName: name.trim() || NAME_PLACEHOLDER, personalLine: personal, myName: props.myFirstName, business: program.business, program: program.program, programLine: program.programLine, link, sponsorship: program.sponsorship, owns: program.owns, mainLink: program.id === null }
  const generated = script
    ? {
        body: renderScript(script.body, values),
        subject: how === 'EMAIL' ? renderScript(script.subject?.trim() || (mode === 'yes' ? "Here's the link" : '{first name}, thought of you'), { ...values, personalLine: '' }) : '',
      }
    : null
  const body = custom?.body ?? generated?.body ?? ''
  const subject = custom?.subject ?? generated?.subject ?? ''
  const disclosure = mode === 'yes' ? null : disclosureLine(props.role, program.owns)
  const footer = how === 'EMAIL' && mode === 'first' ? emailFooter(props.mailingAddress) : null
  const finalText = [body.trim(), disclosure, footer].filter(Boolean).join('\n\n')
  const target = ready ? openTarget(isPost ? 'POST' : how!, finalText, how === 'EMAIL' ? subject : null) : null
  const needsPersonal = mode === 'first' && !!scenario && NEEDS_PERSONAL.includes(scenario)

  function fail(field: Field, text: string) {
    setErr({ field, text })
    const el = field === 'name' ? nameRef.current : field === 'personal' ? personalRef.current : messageRef.current
    setTimeout(() => { el?.focus(); el?.scrollIntoView({ block: 'center', behavior: 'smooth' }) }, 0)
  }

  async function copyAndOpen() {
    if (!isPost && !name.trim()) return fail('name', mode === 'yes' ? 'Add their first name first.' : scenario === 'PARENT' ? "Add the parent's first name first." : 'Add their first name first.')
    if (needsPersonal && !custom && !personal.trim()) return fail('personal', 'Add one line about why you thought of them. It makes people reply.')
    if (!custom && hasBlank(personal)) return fail('personal', 'Change the part in [brackets] to your own words.')
    if (finalText.includes(NAME_PLACEHOLDER)) return fail('message', `Replace ${NAME_PLACEHOLDER} in the message with their name.`)
    if (hasBlank(finalText)) return fail('message', 'Your message still has a part in [brackets]. Change it to your own words.')
    setErr(null)
    if (!(await copyText(finalText))) {
      toast.error('Your browser blocked copying. Press and hold the message, then copy it by hand.')
      return
    }
    toast.success(`Copied. ${pasteWhere(isPost ? 'POST' : how!)}`)
    setAsk({ channel, firstName: isPost ? null : name.trim() })
    openAfterCopy(target)
  }

  async function markSent() {
    if (!ask) return
    setBusy(true)
    const r = await recordShare({ kind: mode === 'yes' ? 'AFTER_YES' : 'FIRST', channel: ask.channel, firstName: ask.firstName, programId: program.id })
    setBusy(false)
    if (!r.ok) { toast.error(r.error); return }
    const n = ask.firstName
    toast.success(mode === 'yes' ? `Great. ${n} counts as a yes in Results.` : isPost ? 'Nice. Your post counts for today.' : `Nice. ${n} is on your Follow-ups for day 3.`)
    setAsk(null); setName(''); setPersonal(''); setCustom(null)
    router.refresh()
  }

  const stepTitle = 'text-lg font-bold text-gray-900'

  return (
    <div className="space-y-6">
      {mode === 'first' && (
        <section aria-labelledby="sy-who" className="space-y-3">
          <h3 id="sy-who" className={stepTitle}>Who is it for?</h3>
          {current ? (
            <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-primary-700 bg-primary-50 px-4 py-3">
              <div className="min-w-0">
                <p className="text-base font-semibold text-gray-900">{current.label}</p>
                <p className="text-sm text-gray-700">{current.hint}</p>
              </div>
              <button type="button" onClick={() => { setScenario(null); setHow(null); setAsk(null) }} className={kit.quiet}>Change</button>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {scenarios.map((s) => (
                <button key={s.key} type="button" onClick={() => setScenario(s.key)} className="flex min-h-[56px] w-full flex-col items-start justify-center rounded-2xl border-2 border-gray-200 bg-white px-4 py-3 text-left hover:border-primary-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2">
                  <span className="text-base font-semibold text-gray-900">{s.label}</span>
                  <span className="text-sm text-gray-600">{s.hint}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {scenario && !isPost && (
        <section aria-labelledby="sy-how" className="space-y-3">
          <h3 id="sy-how" className={stepTitle}>{mode === 'yes' ? 'How are you messaging them?' : 'How will you send it?'}</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {HOW.map((h) => (
              <button key={h.key} type="button" aria-pressed={how === h.key} onClick={() => { setHow(h.key); setAsk(null) }}
                className={`h-12 rounded-xl border-2 px-3 text-base font-semibold ${kit.ring} ${how === h.key ? 'border-primary-700 bg-primary-50 text-primary-900' : 'border-gray-200 bg-white text-gray-900 hover:border-primary-600'}`}>
                {h.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {ready && (
        <section aria-labelledby="sy-msg" className="space-y-4">
          <h3 id="sy-msg" className={stepTitle}>{mode === 'yes' ? 'Your message with the link' : 'Your message'}</h3>
          {!isPost && (
            <div>
              <label htmlFor="sy-name" className={kit.label}>{scenario === 'PARENT' ? "Parent's first name" : 'Their first name'}</label>
              <input id="sy-name" ref={nameRef} value={name} onChange={(e) => { setName(e.target.value); if (err?.field === 'name') setErr(null) }} maxLength={60} autoComplete="off" aria-invalid={err?.field === 'name'} aria-describedby={err?.field === 'name' ? 'sy-name-err' : undefined} className={kit.input} />
              {err?.field === 'name' && <p id="sy-name-err" className="mt-1 text-sm font-semibold text-red-700">{err.text}</p>}
            </div>
          )}
          {mode === 'first' && script?.body.includes('{personal line}') && (
            <div>
              <label htmlFor="sy-personal" className={kit.label}>{isPost ? 'Why this matters to you' : 'Why you thought of them'} <span className="font-normal text-gray-600">({needsPersonal ? 'one line' : 'optional'})</span></label>
              <textarea id="sy-personal" ref={personalRef} value={personal} onChange={(e) => { setPersonal(e.target.value); if (err?.field === 'personal') setErr(null) }} rows={2} maxLength={200}
                placeholder={custom ? `e.g. ${PERSONAL_EXAMPLES[scenario ?? 'KNOW'] ?? PERSONAL_EXAMPLES.KNOW}` : 'Write your own, or tap an idea below'} aria-invalid={err?.field === 'personal'} aria-describedby={err?.field === 'personal' ? 'sy-personal-err' : undefined} className={kit.textarea} />
              {err?.field === 'personal' && <p id="sy-personal-err" className="mt-1 text-sm font-semibold text-red-700">{err.text}</p>}
              {!custom && <LineIdeasPicker id="sy-ideas" ideas={ideasFor(scenario, program.lineIdeas)} target={personalRef} onPick={(l) => { setPersonal(l.slice(0, 200)); if (err?.field === 'personal') setErr(null) }} />}
            </div>
          )}

          {!script ? (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-base text-amber-950">There&apos;s no message for this yet. Pick another situation, or check the Playbook tab.</p>
          ) : (
            <div className="space-y-2">
              {how === 'EMAIL' && (
                <div>
                  <label htmlFor="sy-subject" className={kit.label}>Subject</label>
                  <input id="sy-subject" value={subject} onChange={(e) => setCustom({ body, subject: e.target.value })} maxLength={150} className={kit.input} />
                </div>
              )}
              <label htmlFor="sy-body" className={kit.label}>Message <span className="font-normal text-gray-600">(change anything you like)</span></label>
              <textarea id="sy-body" ref={messageRef} value={body} onChange={(e) => { setCustom({ subject, body: e.target.value }); if (err?.field === 'message') setErr(null) }}
                rows={Math.min(14, Math.max(4, Math.ceil(body.length / 38) + body.split('\n').length - 1))} aria-invalid={err?.field === 'message'} aria-describedby={err?.field === 'message' ? 'sy-body-err' : undefined} className={kit.textarea} />
              {err?.field === 'message' && <p id="sy-body-err" className="text-sm font-semibold text-red-700">{err.text}</p>}
              {custom && (
                <p className="flex flex-wrap items-center gap-x-2 text-sm text-gray-700">
                  You changed the message, so the boxes above won&apos;t update it.
                  <button type="button" onClick={() => setCustom(null)} className={kit.quiet}><RotateCcw className="h-4 w-4" aria-hidden />Start over</button>
                </p>
              )}
              {(disclosure || footer) && (
                <div className="flex gap-2 rounded-xl bg-gray-50 px-3 py-2.5 text-sm text-gray-700">
                  <Lock className="mt-0.5 h-4 w-4 flex-none" aria-hidden />
                  <div className="space-y-1">
                    <p className="font-semibold text-gray-900">Added at the end for you:</p>
                    {disclosure && <p>&quot;{disclosure}&quot;</p>}
                    {footer && footer.split('\n').map((l) => <p key={l}>&quot;{l}&quot;</p>)}
                  </div>
                </div>
              )}
            </div>
          )}

          {script && !ask && (
            <button type="button" onClick={copyAndOpen} className={kit.primaryBlock}>
              <Copy className="h-5 w-5" aria-hidden />{target?.button ?? 'Copy message'}
            </button>
          )}

          {ask && (
            <div className="space-y-3 rounded-2xl border-2 border-green-600 bg-green-50 p-4" role="group" aria-labelledby="sy-ask">
              <p id="sy-ask" className="text-base font-semibold text-gray-900">{isPost ? 'Did you post it?' : `Did you send it${ask.firstName ? ` to ${ask.firstName}` : ''}?`}</p>
              <p className="text-sm text-gray-700">{mode === 'yes' ? 'Saying yes counts them as a yes in Results.' : 'Saying yes counts for today and puts them on Follow-ups for day 3.'}</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={markSent} disabled={busy} className={kit.primary}>{busy && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}Yes, I sent it</button>
                <button type="button" onClick={() => setAsk(null)} className={kit.secondary}>Not yet</button>
              </div>
              <button type="button" onClick={copyAndOpen} className={kit.quiet}><Copy className="h-4 w-4" aria-hidden />Copy again</button>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
