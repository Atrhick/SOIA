'use client'

import { useRef, useState } from 'react'
import { Loader2, Trash2, Upload } from 'lucide-react'
import { useToast } from '@/components/ui/kit/toast'
import { TaskHeader } from '@/components/ui/kit/task-header'
import { kit } from '@/components/ui/kit/styles'
import { removeInvitePhoto, saveInvitePhoto, saveInviteProfile } from '@/lib/actions/invite-profile'
import {
  ACCEPTED_PHOTO_TYPES, MAX_PHOTO_BYTES, PHOTO_QUALITY, PHOTO_SIZE, WHY_MAX, centerCropSquare, initialsOf, isValidJpegDataUrl,
} from './photo-rules'

export interface InviteProfileProgram {
  id: string
  name: string
  /** e.g. "3 of 5 sponsored seats left this month", or null when the program has no offer. */
  seatsLabel: string | null
}

interface Props {
  role: 'COACH' | 'AMBASSADOR'
  name: string
  /** The user's invite slug (for "Preview my page"); null if it could not be created. */
  slug: string | null
  photoUrl: string | null
  why: string
  programId: string | null
  programs: InviteProfileProgram[]
}

const card = kit.card

const MAX_FILE_BYTES = 20 * 1024 * 1024

/** Centre-crop to a square, resize to PHOTO_SIZE and encode as JPEG. Null if it can't get under the size limit. */
async function fileToJpegDataUrl(file: File): Promise<string | null> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('decode'))
      i.src = url
    })
    const { sx, sy, size } = centerCropSquare(img.naturalWidth, img.naturalHeight)
    if (!size) return null
    const canvas = document.createElement('canvas')
    canvas.width = PHOTO_SIZE
    canvas.height = PHOTO_SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#ffffff' // transparent PNG/WebP areas become white, not black
    ctx.fillRect(0, 0, PHOTO_SIZE, PHOTO_SIZE)
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, sx, sy, size, size, 0, 0, PHOTO_SIZE, PHOTO_SIZE)
    for (const q of [PHOTO_QUALITY, 0.7, 0.6]) {
      const data = canvas.toDataURL('image/jpeg', q)
      if (isValidJpegDataUrl(data)) return data
    }
    return null
  } finally {
    URL.revokeObjectURL(url)
  }
}

function Avatar({ src, name, size }: { src: string | null; name: string; size: 'lg' | 'md' }) {
  const cls = size === 'lg' ? 'w-[88px] h-[88px] text-2xl' : 'w-14 h-14 text-base'
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={size === 'lg' ? `Current photo of ${name}` : ''} className={`${cls} rounded-full object-cover bg-sky-100 flex-none`} />
  }
  return (
    <div className={`${cls} rounded-full bg-sky-100 text-sky-800 font-bold flex items-center justify-center flex-none`} role={size === 'lg' ? 'img' : undefined} aria-label={size === 'lg' ? 'No photo yet' : undefined} aria-hidden={size === 'lg' ? undefined : true}>
      {initialsOf(name)}
    </div>
  )
}

/** Example "why" lines: adults talk about their work; ambassadors (many are teens) about what they care about. */
const EXAMPLE_WHY = {
  COACH: 'I burned out at 30. Now I help busy parents build small habits that keep stress in check.',
  AMBASSADOR: 'A mentor helped me figure out what I wanted to do. I want other teens to have that too.',
}

/** The current photo as a data URL, so "Remove photo" can be undone. Null if it can't be read. */
async function photoAsDataUrl(src: string): Promise<string | null> {
  if (src.startsWith('data:')) return src
  try {
    const blob = await (await fetch(src, { cache: 'no-store' })).blob()
    return await new Promise<string | null>((resolve) => {
      const r = new FileReader()
      r.onload = () => resolve(typeof r.result === 'string' && isValidJpegDataUrl(r.result) ? r.result : null)
      r.onerror = () => resolve(null)
      r.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

export function InviteProfileClient({ role, name, slug, photoUrl, why: initialWhy, programId: initialProgramId, programs }: Props) {
  const roleWord = role === 'COACH' ? 'coach' : 'ambassador'
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const whyRef = useRef<HTMLTextAreaElement>(null)

  const [photo, setPhoto] = useState<string | null>(photoUrl)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [why, setWhy] = useState(initialWhy)
  const [programId, setProgramId] = useState(initialProgramId && programs.some((p) => p.id === initialProgramId) ? initialProgramId : '')
  const [saving, setSaving] = useState<'save' | 'preview' | null>(null)
  const [whyError, setWhyError] = useState<string | null>(null)

  const left = WHY_MAX - why.length
  const shownWhy = why.replace(/\s+/g, ' ').trim()
  const chosen = programs.find((p) => p.id === programId)
  const previewUrl = slug ? `/join/${encodeURIComponent(slug)}` : null

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!(ACCEPTED_PHOTO_TYPES as readonly string[]).includes(file.type)) { toast.error('Choose a JPG, PNG or WebP photo.'); return }
    if (file.size > MAX_FILE_BYTES) { toast.error('That file is too large. Choose a photo under 20 MB.'); return }
    setPhotoBusy(true)
    try {
      const data = await fileToJpegDataUrl(file).catch(() => null)
      if (!data) { toast.error(`That photo could not be made small enough (under ${Math.round(MAX_PHOTO_BYTES / 1024)} KB). Try a simpler photo.`); return }
      const r = await saveInvitePhoto(data)
      if (!r.ok) { toast.error(r.error); return }
      setPhoto(data)
      toast.success('Photo saved.')
    } finally {
      setPhotoBusy(false)
    }
  }

  async function onRemovePhoto() {
    if (!photo) return
    setPhotoBusy(true)
    try {
      const before = await photoAsDataUrl(photo)
      const r = await removeInvitePhoto()
      if (!r.ok) { toast.error(r.error); return }
      setPhoto(null)
      toast.success('Photo removed.', before ? {
        action: {
          label: 'Undo',
          onClick: async () => {
            const u = await saveInvitePhoto(before)
            if (u.ok) { setPhoto(before); toast.success('Photo put back.') } else toast.error(u.error)
          },
        },
      } : undefined)
    } finally {
      setPhotoBusy(false)
    }
  }

  /** Saves; with `preview`, then opens the sign-up page in a new tab so it shows what was just saved. */
  async function save(preview: boolean) {
    setWhyError(null)
    if (left < 0) {
      setWhyError(`Make it ${-left} characters shorter (${WHY_MAX} at most).`)
      whyRef.current?.focus()
      return
    }
    // Open the tab inside the tap (phones block pop-ups opened later), then point it at the page once saved.
    const tab = preview && previewUrl ? window.open('about:blank', '_blank') : null
    setSaving(preview ? 'preview' : 'save')
    try {
      const r = await saveInviteProfile({ why, programId })
      if (!r.ok) { tab?.close(); toast.error(r.error); return }
      if (preview && previewUrl) {
        if (tab) tab.location.href = previewUrl
        else window.location.href = previewUrl
        toast.success('Saved. Your page opened in a new tab.')
      } else {
        toast.success('Saved. People see this on your sign-up page.')
      }
    } catch {
      tab?.close()
      toast.error("That didn't save. Check your connection and try again.")
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="space-y-5">
      <TaskHeader title="Your invite profile" doThis="Add a photo and one line on why you do this. People see it when you invite them." />

      <div className="flex flex-wrap items-start gap-5">
        <form onSubmit={(e) => { e.preventDefault(); save(false) }} noValidate className={`${card} min-w-0 flex-[3_1_480px] space-y-6`}>
          <div className="flex flex-wrap items-center gap-4">
            <Avatar src={photo} name={name} size="lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-base font-semibold text-gray-900">Your photo</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={kit.secondary} onClick={() => fileRef.current?.click()} disabled={photoBusy}>
                  {photoBusy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Upload className="h-5 w-5" aria-hidden />}
                  {photo ? 'Change photo' : 'Add a photo'}
                </button>
                {photo && (
                  <button type="button" className={kit.secondary} onClick={onRemovePhoto} disabled={photoBusy}>
                    <Trash2 className="h-5 w-5" aria-hidden /> Remove
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-hidden onChange={onPickFile} />
            </div>
            <p className={`${kit.hint} basis-full`}>A clear, smiling photo of your face gets more sign-ups than a logo. It saves as soon as you pick it.</p>
          </div>

          <div>
            <label className={kit.label} htmlFor="invite-why">Why I do this</label>
            <textarea
              ref={whyRef}
              id="invite-why"
              rows={3}
              maxLength={WHY_MAX + 40}
              value={why}
              onChange={(e) => { setWhy(e.target.value.replace(/[\r\n]+/g, ' ')); setWhyError(null) }}
              placeholder={EXAMPLE_WHY[role]}
              className={kit.textarea}
              aria-describedby="invite-why-hint"
              aria-invalid={left < 0 || !!whyError}
            />
            <p id="invite-why-hint" className={kit.hint}>
              One line in your own words, for example: &ldquo;{EXAMPLE_WHY[role]}&rdquo; Say what you do; never promise results.{' '}
              <span className={left < 0 ? 'font-semibold text-red-700' : ''} aria-live="polite">
                {left >= 0 ? `${left} characters left.` : `${-left} characters too long.`}
              </span>
            </p>
            {whyError && <p role="alert" className="mt-1 text-sm font-semibold text-red-700">{whyError}</p>}
          </div>

          <div>
            <label className={kit.label} htmlFor="invite-program">Program your main link shares</label>
            <select id="invite-program" className={`${kit.input} truncate pr-8`} value={programId} onChange={(e) => setProgramId(e.target.value)} disabled={programs.length === 0} aria-describedby="invite-program-hint">
              <option value="">Automatic</option>
              {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <p id="invite-program-hint" className={kit.hint}>
              {programs.length === 0
                ? "You don't have a live program page yet, so your main link uses the standard sign-up."
                : <>
                    {chosen ? (chosen.seatsLabel ? `${chosen.name}: ${chosen.seatsLabel}. ` : '') : 'Automatic shares your newest live program. '}
                    You set your program&apos;s prices on its program page. The NowTransformed team sets how many sponsored seats each program has.
                  </>}
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            {previewUrl && (
              <button type="button" className={`${kit.primary} flex-1 whitespace-nowrap`} onClick={() => save(true)} disabled={!!saving}>
                {saving === 'preview' && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}Save and preview
              </button>
            )}
            <button type="submit" className={`${previewUrl ? kit.secondary : kit.primary} flex-1`} disabled={!!saving}>
              {saving === 'save' && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}Save
            </button>
          </div>
        </form>

        <aside className={`${card} min-w-0 flex-[2_1_300px] space-y-3`} aria-label="Preview of the top of your sign-up page">
          <p className="text-base font-bold text-gray-900">How it looks to people you invite</p>
          <div className="space-y-3 rounded-xl border border-gray-200 bg-slate-50 p-4">
            <div className="flex items-center gap-3">
              <Avatar src={photo} name={name} size="md" />
              <div className="min-w-0">
                <p className="text-sm text-gray-600">Invited by</p>
                <p className="truncate text-base font-bold text-gray-900">{name}</p>
                <p className="text-sm text-gray-600">NowTransformed {roleWord}</p>
              </div>
            </div>
            {shownWhy ? (
              <p className="break-words text-base leading-relaxed text-gray-800">&ldquo;{shownWhy}&rdquo;</p>
            ) : (
              <p className="text-base italic text-gray-600">Your &ldquo;why I do this&rdquo; line shows here.</p>
            )}
          </div>
          <p className={kit.hint}>Parents of teens see the same card.</p>
        </aside>
      </div>
    </div>
  )
}
