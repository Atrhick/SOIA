'use client'

/**
 * The page editor's fields: text with a letter count, photos (upload or paste an address, description
 * required), lists (Add / Remove / Move up / Move down) and "Include this part" switches. Every field reads
 * and writes the page through EditorContext and shows its own problems from pageWarnings under it.
 */
/* eslint-disable @next/next/no-img-element -- small thumbnails of the page's own photos */
import { createContext, useContext, useId, useRef, useState, type ReactNode } from 'react'
import type { PageWarning } from '@/lib/program-info/page-checks'
import { uploadProgramPageImage } from '@/lib/actions/program-page-images'
import { kit } from '@/components/ui/kit/styles'
import { getAt, pathKey, type Path } from './model'

export interface EditorApi {
  page: Record<string, unknown>
  set: (p: Path, value: unknown) => void
  /** Problems for exactly this field. */
  warn: (p: Path) => PageWarning[]
  programId: string
}

export const EditorContext = createContext<EditorApi | null>(null)
export function useEditor(): EditorApi {
  const c = useContext(EditorContext)
  if (!c) throw new Error('EditorContext missing')
  return c
}

export const smallBtn = `inline-flex min-h-[44px] items-center justify-center rounded-xl border-2 border-primary-600 bg-white px-3.5 text-sm font-semibold text-primary-700 shadow-sm hover:bg-primary-50 disabled:border-gray-300 disabled:text-gray-500 disabled:shadow-none ${kit.ring}`
const plainBtn = `inline-flex min-h-[44px] items-center justify-center rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:text-gray-400 ${kit.ring}`

export const fieldId = (p: Path) => `f-${pathKey(p).replace(/[^A-Za-z0-9_-]/g, '-')}`

/** The field's problems, linked to it with aria-describedby. */
function Problems({ id, items }: { id: string; items: PageWarning[] }) {
  if (items.length === 0) return null
  return (
    <ul id={id} className="m-0 mt-1.5 flex list-none flex-col gap-1 p-0">
      {items.map((w, i) => (
        <li key={i} className={`rounded-lg px-2.5 py-1.5 text-sm ${w.blocking ? 'border border-red-300 bg-red-50 font-medium text-red-800' : 'border border-amber-300 bg-amber-50 text-amber-900'}`}>
          <span className="font-bold">{w.blocking ? 'Fix: ' : 'Check: '}</span>
          {w.message.replace(/^[^:]*:\s*/, '')}
        </li>
      ))}
    </ul>
  )
}

/** Problems for a list or a part as a whole (e.g. "needs exactly 3 points"). */
export function GroupProblems({ path }: { path: Path }) {
  const { warn } = useEditor()
  return <Problems id={`${fieldId(path)}-problems`} items={warn(path)} />
}

export function TextField({ path, label, max, multiline, hint, required, rows }: {
  path: Path
  label: string
  max: number
  multiline?: boolean
  hint?: ReactNode
  required?: boolean
  rows?: number
}) {
  const { page, set, warn } = useEditor()
  const id = fieldId(path)
  const raw = getAt(page, path)
  const value = typeof raw === 'string' ? raw : ''
  const problems = warn(path)
  const count = value.trim().length
  const over = count > max
  const described = [hint ? `${id}-hint` : '', `${id}-count`, problems.length ? `${id}-problems` : ''].filter(Boolean).join(' ')
  const cls = `${multiline ? kit.textarea : kit.input} ${problems.some((w) => w.blocking) ? 'border-red-500' : ''}`
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={kit.label}>
        {label} <span className="font-normal text-gray-600">(up to {max} letters{required === false ? ', optional' : ''})</span>
      </label>
      {multiline ? (
        <textarea id={id} rows={rows ?? 4} value={value} aria-invalid={problems.some((w) => w.blocking) || undefined} aria-describedby={described} onChange={(e) => set(path, e.target.value)} className={cls} />
      ) : (
        <input id={id} value={value} aria-invalid={problems.some((w) => w.blocking) || undefined} aria-describedby={described} onChange={(e) => set(path, e.target.value)} className={cls} />
      )}
      <div className="mt-1 flex flex-wrap items-start justify-between gap-x-3">
        {hint ? <p id={`${id}-hint`} className="m-0 min-w-0 flex-1 text-sm text-gray-600">{hint}</p> : <span />}
        <p id={`${id}-count`} className={`m-0 text-sm ${over ? 'font-bold text-red-700' : 'text-gray-600'}`}>{count} / {max} letters</p>
      </div>
      <Problems id={`${id}-problems`} items={problems} />
    </div>
  )
}

export function NumberField({ path, label, min, max, hint }: { path: Path; label: string; min: number; max: number; hint?: string }) {
  const { page, set, warn } = useEditor()
  const id = fieldId(path)
  const raw = getAt(page, path)
  const problems = warn(path)
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={kit.label}>{label}</label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={typeof raw === 'number' ? raw : ''}
        aria-describedby={[hint ? `${id}-hint` : '', problems.length ? `${id}-problems` : ''].filter(Boolean).join(' ') || undefined}
        onChange={(e) => set(path, e.target.value === '' ? 0 : Number(e.target.value))}
        className={kit.input}
      />
      {hint && <p id={`${id}-hint`} className={kit.hint}>{hint}</p>}
      <Problems id={`${id}-problems`} items={problems} />
    </div>
  )
}

export function CheckField({ path, label, hint }: { path: Path; label: string; hint?: string }) {
  const { page, set } = useEditor()
  const id = fieldId(path)
  return (
    <div>
      <label htmlFor={id} className="flex min-h-[44px] cursor-pointer items-center gap-3 text-base font-semibold text-gray-900">
        <input id={id} type="checkbox" checked={getAt(page, path) === true} onChange={(e) => set(path, e.target.checked)} aria-describedby={hint ? `${id}-hint` : undefined} className="h-5 w-5 flex-none rounded border-gray-400" />
        {label}
      </label>
      {hint && <p id={`${id}-hint`} className="m-0 text-sm text-gray-600">{hint}</p>}
    </div>
  )
}

/**
 * "Include this part" switch. Off removes the key; the text is kept in memory, so switching it back on
 * brings it back.
 */
export function IncludeSwitch({ path, label, make, hint }: { path: Path; label: string; make: () => unknown; hint?: string }) {
  const { page, set } = useEditor()
  const stash = useRef<unknown>(undefined)
  const id = `${fieldId(path)}-on`
  const on = getAt(page, path) !== undefined
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2">
      <label htmlFor={id} className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 text-base font-semibold text-gray-900">
        <span className="min-w-0">{label}</span>
        <span className="relative inline-flex flex-none items-center">
          <input
            id={id}
            type="checkbox"
            role="switch"
            checked={on}
            aria-describedby={hint ? `${id}-hint` : undefined}
            onChange={(e) => {
              if (e.target.checked) set(path, stash.current ?? make())
              else {
                stash.current = getAt(page, path)
                set(path, undefined)
              }
            }}
            className="peer sr-only"
          />
          <span aria-hidden className="h-7 w-12 rounded-full bg-gray-300 transition peer-checked:bg-primary-700 peer-focus-visible:ring-2 peer-focus-visible:ring-primary-600 peer-focus-visible:ring-offset-2" />
          <span aria-hidden className="absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
          <span className="ml-2 w-7 text-sm font-semibold text-gray-700">{on ? 'On' : 'Off'}</span>
        </span>
      </label>
      {hint && <p id={`${id}-hint`} className="m-0 pb-1 text-sm text-gray-600">{hint}</p>}
    </div>
  )
}

/** A list with Add / Remove / Move up / Move down. */
export function ListField({ path, title, noun, max, min = 0, make, render, hint }: {
  path: Path
  title: string
  /** "point" -> "Point 1", "Add a point" */
  noun: string
  max: number
  min?: number
  make: () => unknown
  render: (itemPath: Path, index: number) => ReactNode
  hint?: string
}) {
  const { page, set } = useEditor()
  const raw = getAt(page, path)
  const items = Array.isArray(raw) ? raw : []
  const Noun = noun.charAt(0).toUpperCase() + noun.slice(1)
  const move = (from: number, to: number) => {
    const next = items.slice()
    const [x] = next.splice(from, 1)
    next.splice(to, 0, x)
    set(path, next)
  }
  const article = /^[aeiou]/i.test(noun) ? 'an' : 'a'
  return (
    <fieldset className="m-0 min-w-0 rounded-xl border border-gray-200 p-3 sm:p-3.5">
      <legend className="px-1 text-base font-bold text-gray-900">{title} <span className="font-normal text-gray-600">({items.length} of up to {max})</span></legend>
      {hint && <p className="m-0 mb-2 text-sm text-gray-600">{hint}</p>}
      <GroupProblems path={path} />
      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        {items.map((_, i) => (
          <li key={i} className="flex min-w-0 flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-bold uppercase tracking-wide text-gray-700">{Noun} {i + 1}</span>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" className={plainBtn} disabled={i === 0} onClick={() => move(i, i - 1)}>Move up<span className="sr-only"> {noun} {i + 1}</span></button>
                <button type="button" className={plainBtn} disabled={i === items.length - 1} onClick={() => move(i, i + 1)}>Move down<span className="sr-only"> {noun} {i + 1}</span></button>
                <button type="button" className={`${plainBtn} text-red-700`} disabled={items.length <= min} onClick={() => set(path, items.filter((__, j) => j !== i))}>Remove<span className="sr-only"> {noun} {i + 1}</span></button>
              </div>
            </div>
            {render([...path, i], i)}
          </li>
        ))}
      </ol>
      <button type="button" className={`${smallBtn} mt-3`} disabled={items.length >= max} onClick={() => set(path, [...items, make()])}>
        Add {article} {noun}
      </button>
      {items.length >= max && <p className="m-0 mt-1 text-sm text-gray-600">That&apos;s the most this part can hold.</p>}
    </fieldset>
  )
}

// ---------- photos ----------

const MAX_BYTES = 5 * 1024 * 1024
const SEND_LIMIT = 1.9 * 1024 * 1024
const MAX_WIDTH = 1600

/** Shrinks a photo to 1600px wide and turns it into WebP (JPEG if the browser can't write WebP). */
async function shrink(file: File): Promise<File> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, MAX_WIDTH / bmp.width)
  const w = Math.round(bmp.width * scale)
  const h = Math.round(bmp.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const g = canvas.getContext('2d')
  if (!g) throw new Error('no canvas')
  g.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  const toBlob = (type: string) => new Promise<Blob | null>((res) => canvas.toBlob(res, type, 0.85))
  let blob = await toBlob('image/webp')
  if (!blob || blob.type !== 'image/webp') blob = await toBlob('image/jpeg')
  if (!blob) throw new Error('encode failed')
  const base = file.name.replace(/\.[^.]*$/, '') || 'photo'
  return new File([blob], `${base}.${blob.type === 'image/webp' ? 'webp' : 'jpg'}`, { type: blob.type })
}

/**
 * One photo: upload it (after the permission tick) or paste an address (/offers/... or https), and its
 * description, which every photo needs. `noAlt` for a testimonial's small face photo (the name says who it is).
 */
export function ImageField({ path, label, withNote, withHandNote, noAlt }: {
  /** The image object ({src, alt, ...}); with noAlt, the address string itself. */
  path: Path
  label: string
  withNote?: boolean
  withHandNote?: boolean
  noAlt?: boolean
}) {
  const { page, set, warn, programId } = useEditor()
  const uid = useId()
  const srcPath = noAlt ? path : [...path, 'src']
  const src = getAt(page, srcPath)
  const srcText = typeof src === 'string' ? src : ''
  const id = fieldId(srcPath)
  const fileRef = useRef<HTMLInputElement>(null)
  const [permission, setPermission] = useState(false)
  const [minor, setMinor] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const problems = warn(srcPath)
  const usable = /^\/[A-Za-z0-9/_.-]+$/.test(srcText) || /^https:\/\/[^\s"'<>]+$/.test(srcText)

  const upload = async (file: File) => {
    setError(null)
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return setError('Choose a JPG, PNG or WebP photo.')
    if (file.size > MAX_BYTES) return setError('That photo is over 5 MB. Choose a smaller one.')
    setBusy(true)
    try {
      let send: File = file
      try {
        send = await shrink(file)
      } catch {
        send = file
      }
      if (send.size > SEND_LIMIT) {
        setError('That photo is still too big after shrinking it. Choose a smaller one.')
        return
      }
      const fd = new FormData()
      fd.set('programId', programId)
      fd.set('permission', permission ? 'yes' : '')
      fd.set('file', send)
      const r = await uploadProgramPageImage(fd)
      if (!r.ok) setError(r.error)
      else set(srcPath, r.url)
    } catch {
      setError('The photo could not be uploaded. Please try again.')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
      <p className="m-0 text-base font-bold text-gray-900">{label}</p>
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex h-20 w-28 flex-none items-center justify-center overflow-hidden rounded-lg border border-gray-300 bg-white text-center text-xs text-gray-500">
          {usable ? <img src={srcText} alt="" className="h-full w-full object-cover" /> : 'No photo yet'}
        </div>
        <div className="flex min-w-0 flex-1 basis-56 flex-col gap-2">
          <label htmlFor={`${uid}-perm`} className="flex min-h-[44px] cursor-pointer items-center gap-2.5 text-sm font-semibold text-gray-900">
            <input id={`${uid}-perm`} type="checkbox" checked={permission} onChange={(e) => { setPermission(e.target.checked); if (!e.target.checked) setMinor(false) }} className="h-5 w-5 flex-none rounded border-gray-400" />
            We have permission to use this photo
          </label>
          {permission && (
            <label htmlFor={`${uid}-minor`} className="flex min-h-[44px] cursor-pointer items-center gap-2.5 text-sm font-semibold text-gray-900">
              <input id={`${uid}-minor`} type="checkbox" checked={minor} onChange={(e) => setMinor(e.target.checked)} className="h-5 w-5 flex-none rounded border-gray-400" />
              Shows someone under 18: parent permission given
            </label>
          )}
          <input ref={fileRef} id={`${uid}-file`} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f) }} />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={smallBtn} disabled={!permission || busy} aria-describedby={`${uid}-up-hint`} onClick={() => fileRef.current?.click()}>
              {busy ? 'Uploading…' : srcText ? 'Upload a different photo' : 'Upload photo'}
            </button>
          </div>
          <p id={`${uid}-up-hint`} className="m-0 text-sm text-gray-600">
            {permission ? 'JPG, PNG or WebP, up to 5 MB. It is made 1600px wide at most.' : 'Tick "We have permission to use this photo" first. JPG, PNG or WebP, up to 5 MB.'}
          </p>
          {error && <p role="alert" className="m-0 rounded-lg border border-red-300 bg-red-50 px-2.5 py-1.5 text-sm font-medium text-red-800">{error}</p>}
        </div>
      </div>
      <div className="min-w-0">
        <label htmlFor={id} className={kit.label}>Photo address</label>
        <input id={id} value={srcText} onChange={(e) => set(srcPath, e.target.value)} aria-describedby={`${id}-hint${problems.length ? ` ${id}-problems` : ''}`} className={`${kit.input} ${problems.some((w) => w.blocking) ? 'border-red-500' : ''}`} />
        <p id={`${id}-hint`} className={kit.hint}>Filled in when you upload. Or paste a photo we already have, e.g. /offers/explorenation/listing-phone.webp, or an https link.</p>
        <Problems id={`${id}-problems`} items={problems} />
      </div>
      {!noAlt && (
        <TextField path={[...path, 'alt']} label="Describe the photo" max={300} hint="For people who can't see it, e.g. “Justin with a family at their kitchen table”. Every photo needs one." />
      )}
      {withNote && <TextField path={[...path, 'note']} label="Handwritten note on the photo" max={60} required={false} />}
      {withHandNote && <TextField path={[...path, 'handNote']} label="Second handwritten note" max={60} required={false} />}
    </div>
  )
}
