'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { kit } from '@/components/ui/kit/styles'
import { useToast } from '@/components/ui/kit/toast'
import { ScriptEditor } from '@/components/get-involved/playbook/script-editor'
import { generalKey, type GeneralScriptRow } from '@/components/get-involved/playbook/helpers'
import { resetGeneralScript, saveGeneralScript } from '@/lib/actions/program-scripts'
import {
  GROUP_LABELS, SCENARIOS, VARIANT_LABELS, renderScript,
  type GeneralScripts, type Scenario, type ScenarioKey, type ScriptGroup, type ScriptText, type ScriptVariant,
} from '@/lib/get-involved/scripts'

const SAMPLE = {
  firstName: 'Maria',
  personalLine: 'You mentioned Jordan has a lot of change coming up this year.',
  myName: 'Elizabeth',
  business: 'DreamIt LiveIt',
  program: 'Vision Development',
  programLine: 'a 4-week online program that helps teens in foster care plan what comes next',
  link: 'https://example.org/join/elizabeth/vision-development?via=text',
  sponsorship: true,
}

type Item = { scenario: Scenario; variant: ScriptVariant; key: string }
const ITEMS: Item[] = (SCENARIOS as readonly Scenario[]).flatMap((s) => s.variants.map((v) => ({ scenario: s, variant: v, key: generalKey(s.key as ScenarioKey, v) })))

export function TemplatesClient({ rows, builtIn }: { rows: GeneralScriptRow[]; builtIn: GeneralScripts }) {
  const router = useRouter()
  const toast = useToast()
  const [key, setKey] = useState(ITEMS[0].key)
  const editorRef = useRef<HTMLElement>(null)
  const item = ITEMS.find((i) => i.key === key) ?? ITEMS[0]
  const scenario = item.scenario.key as ScenarioKey
  const row = rows.find((r) => r.key === key) ?? null
  const base = builtIn[key as keyof GeneralScripts] ?? null
  const start: ScriptText = row ? { subject: row.subject, body: row.body } : base ?? { subject: null, body: '' }

  const statusOf = (k: string): { text: string; cls: string } => {
    const r = rows.find((x) => x.key === k)
    if (r?.status === 'LIVE') return { text: 'Changed', cls: 'bg-green-100 text-green-800' }
    if (r?.status === 'DRAFT') return { text: 'Draft', cls: 'bg-amber-100 text-amber-900' }
    if (builtIn[k as keyof GeneralScripts]) return { text: 'Built-in', cls: 'bg-gray-100 text-gray-700' }
    return { text: 'Not written', cls: 'bg-red-100 text-red-800' }
  }

  function pick(k: string) {
    setKey(k)
    requestAnimationFrame(() => {
      if (window.matchMedia('(max-width: 1023px)').matches) editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  async function save(t: ScriptText, status: 'LIVE' | 'DRAFT') {
    const r = await saveGeneralScript({ scenario, variant: item.variant, subject: t.subject, body: t.body, status })
    if (r.ok) {
      toast.success(status === 'LIVE' ? 'Saved. Members see it now.' : 'Saved as a draft. Members still see the live message.')
      router.refresh()
    }
    return r
  }
  async function reset() {
    const before = row
    const r = await resetGeneralScript({ scenario, variant: item.variant })
    if (r.ok) {
      router.refresh()
      toast.success(base ? 'Back to the built-in message.' : 'Removed.', before ? {
        action: { label: 'Undo', onClick: async () => {
          const u = await saveGeneralScript({ scenario, variant: item.variant, subject: before.subject, body: before.body, status: before.status })
          if (u.ok) { toast.success('Your version is back.'); router.refresh() } else toast.error(u.error)
        } },
      } : undefined)
    }
    return r
  }

  const groups = (Object.keys(GROUP_LABELS) as ScriptGroup[]).map((g) => ({ g, items: ITEMS.filter((i) => i.scenario.group === g) }))
  const preview = renderScript(start.body, SAMPLE)
  const status = statusOf(key)

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[320px_1fr]">
      <nav aria-label="Situations" className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        {groups.map(({ g, items }) => (
          <div key={g}>
            <p className="px-4 pb-2 pt-4 text-sm font-bold uppercase tracking-wide text-gray-600">{GROUP_LABELS[g]}</p>
            <ul>
              {items.map((i) => {
                const s = statusOf(i.key)
                return (
                  <li key={i.key}>
                    <button type="button" onClick={() => pick(i.key)} aria-current={key === i.key ? 'true' : undefined}
                      className={`flex min-h-[48px] w-full items-center justify-between gap-2 border-t border-gray-100 px-4 py-2.5 text-left ${kit.ring} focus-visible:ring-offset-0 ${key === i.key ? 'bg-primary-50 text-primary-900' : 'text-gray-900 hover:bg-gray-50'}`}>
                      <span className="min-w-0">
                        <span className="block text-base font-semibold">{i.scenario.label}</span>
                        {i.scenario.variants.length > 1 && <span className="block text-sm text-gray-600">{VARIANT_LABELS[i.variant]}</span>}
                      </span>
                      <span className={`flex-none rounded-full px-2 py-0.5 text-sm font-semibold ${s.cls}`}>{s.text}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <section ref={editorRef} aria-labelledby="tpl-title" className={`${kit.card} min-w-0 scroll-mt-4 space-y-5`}>
        <div>
          <h2 id="tpl-title" className="text-xl font-bold text-gray-900">{item.scenario.label} · {VARIANT_LABELS[item.variant]}</h2>
          <p className="mt-1 text-base text-gray-700">{item.scenario.hint}</p>
          <p className="mt-2 text-sm text-gray-600">
            {row?.status === 'LIVE' ? 'Your version is live.' : row?.status === 'DRAFT' ? 'Draft: members still see the built-in message.' : base ? 'Using the built-in message.' : 'No message yet: members see nothing for this situation.'}
            {item.scenario.ownerOnly ? ' Only program owners see this situation.' : ''}
            {item.scenario.adultsOnly ? ' Never shown to members under 18.' : ''}
          </p>
          <span className="sr-only">Status: {status.text}</span>
        </div>

        <ScriptEditor key={`${key}-${row?.updatedAt ?? 'base'}`} idPrefix="tpl" scenario={scenario} variant={item.variant} initial={start}
          saveLabel="Save and make live" onSave={(t) => save(t, 'LIVE')} onSaveDraft={(t) => save(t, 'DRAFT')}
          resetLabel={row ? 'Reset to the built-in message' : undefined}
          resetConfirm="Go back to the built-in message? Your saved version is deleted. You can undo right after."
          onReset={row ? reset : undefined} />

        {start.body.trim() && (
          <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-4">
            <p className="text-sm font-bold text-gray-700">How it reads (saved version, sample names)</p>
            {item.variant === 'EMAIL' && start.subject && <p className="mt-2 text-base"><span className="text-gray-600">Subject: </span><strong>{renderScript(start.subject, SAMPLE)}</strong></p>}
            <p className="mt-2 max-w-prose whitespace-pre-line text-base leading-relaxed text-gray-900">{preview}</p>
          </div>
        )}
      </section>
    </div>
  )
}
