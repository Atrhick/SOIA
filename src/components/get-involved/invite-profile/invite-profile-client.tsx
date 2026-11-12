'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { Loader2, Trash2, Upload } from 'lucide-react'
import { removeInvitePhoto, saveInvitePhoto, saveInviteProfile } from '@/lib/actions/invite-profile'
import {
  ACCEPTED_PHOTO_TYPES, MAX_PHOTO_BYTES, PHOTO_QUALITY, PHOTO_SIZE, WHY_MAX, centerCropSquare, initialsOf, isValidJpegDataUrl,
} from './photo-rules'

export interface InviteProfileProgram {
  id: string
  name: string
  /** e.g. "sponsored seats: 3 of 5 left", or null when the program has no offer. */
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

const inp = 'w-full h-11 rounded-lg border border-gray-400 px-3 text-[15px] text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600 disabled:bg-gray-100 disabled:text-gray-500'
const lbl = 'block text-sm font-semibold text-gray-800'
const hint = 'text-[13px] text-gray-600'
const card = 'bg-white border border-gray-200 rounded-xl p-4 sm:p-5'
const btnPrimary = 'h-12 px-4 rounded-lg bg-primary-700 hover:bg-primary-800 text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2'
const btnSecondary = 'h-11 px-4 rounded-lg border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 text-sm font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2'

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

export function InviteProfileClient({ role, name, slug, photoUrl, why: initialWhy, programId: initialProgramId, programs }: Props) {
  const base = role === 'COACH' ? '/coach' : '/ambassador'
  const roleWord = role === 'COACH' ? 'coach' : 'ambassador'
  const fileRef = useRef<HTMLInputElement>(null)

  const [photo, setPhoto] = useState<string | null>(photoUrl)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [why, setWhy] = useState(initialWhy)
  const [programId, setProgramId] = useState(initialProgramId && programs.some((p) => p.id === initialProgramId) ? initialProgramId : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const left = WHY_MAX - why.length
  const shownWhy = why.replace(/\s+/g, ' ').trim()

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null); setNotice(null)
    if (!(ACCEPTED_PHOTO_TYPES as readonly string[]).includes(file.type)) { setError('Choose a JPG, PNG or WebP photo.'); return }
    if (file.size > MAX_FILE_BYTES) { setError('That file is too large. Choose a photo under 20 MB.'); return }
    setPhotoBusy(true)
    try {
      const data = await fileToJpegDataUrl(file).catch(() => null)
      if (!data) { setError(`That photo could not be made small enough (under ${Math.round(MAX_PHOTO_BYTES / 1024)} KB). Try a simpler photo.`); return }
      const r = await saveInvitePhoto(data)
      if (!r.ok) { setError(r.error); return }
      setPhoto(data)
      setNotice('Photo saved.')
    } finally {
      setPhotoBusy(false)
    }
  }

  async function onRemovePhoto() {
    setError(null); setNotice(null)
    setPhotoBusy(true)
    try {
      const r = await removeInvitePhoto()
      if (!r.ok) { setError(r.error); return }
      setPhoto(null)
      setNotice('Photo removed.')
    } finally {
      setPhotoBusy(false)
    }
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null); setNotice(null)
    if (left < 0) { setError(`Keep "why I do this" to ${WHY_MAX} characters.`); return }
    setSaving(true)
    try {
      const r = await saveInviteProfile({ why, programId })
      if (!r.ok) setError(r.error)
      else setNotice('Profile saved.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[13px] text-gray-600">
          <Link href={`${base}/one-a-day`} className="text-sky-800 hover:text-sky-900 underline-offset-2 hover:underline">One-A-Day</Link> / My invite profile
        </p>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">My invite profile</h1>
        <p className="text-gray-600 mt-1">What people see at the top of your sign-up page and in your messages. Set it once.</p>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}
      {notice && !error && (
        <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{notice}</div>
      )}

      <div className="flex flex-wrap gap-5 items-start">
        <form onSubmit={onSave} className={`${card} flex-[3_1_520px] min-w-0 space-y-5`}>
          <div className="flex flex-wrap items-center gap-4">
            <Avatar src={photo} name={name} size="lg" />
            <div className="space-y-1.5 min-w-0 flex-1">
              <div className="flex flex-wrap gap-2">
                <button type="button" className={btnSecondary} onClick={() => fileRef.current?.click()} disabled={photoBusy}>
                  {photoBusy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Upload className="w-4 h-4" aria-hidden />}
                  {photo ? 'Change photo' : 'Upload a photo'}
                </button>
                {photo && (
                  <button type="button" className={btnSecondary} onClick={onRemovePhoto} disabled={photoBusy}>
                    <Trash2 className="w-4 h-4" aria-hidden /> Remove photo
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-hidden onChange={onPickFile} />
              <p className={hint}>A clear, smiling photo of your face. A real photo gets more sign-ups than a logo. JPG, PNG or WebP; we crop it to a square.</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={lbl} htmlFor="invite-why">Why I do this (one line)</label>
            <textarea
              id="invite-why"
              rows={3}
              maxLength={WHY_MAX + 40}
              value={why}
              onChange={(e) => setWhy(e.target.value.replace(/[\r\n]+/g, ' '))}
              placeholder="I started this program because I burned out at 30. Now I help busy parents build habits that keep stress in check."
              className={`${inp} h-auto py-2.5 leading-normal`}
              aria-describedby="invite-why-hint"
              aria-invalid={left < 0}
            />
            <p id="invite-why-hint" className={hint}>
              Your own words. Describe what you do, not promised results.{' '}
              <span className={left < 0 ? 'text-red-700 font-semibold' : ''} aria-live="polite">
                {left >= 0 ? `${left} characters left.` : `${-left} characters over.`}
              </span>
            </p>
          </div>

          <div className="space-y-1.5">
            <label className={lbl} htmlFor="invite-program">Program my main link shares</label>
            <select id="invite-program" className={inp} value={programId} onChange={(e) => setProgramId(e.target.value)} disabled={programs.length === 0} aria-describedby="invite-program-hint">
              <option value="">Automatic: my most recent live program</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>{p.name}{p.seatsLabel ? ` (${p.seatsLabel})` : ''}</option>
              ))}
            </select>
            <p id="invite-program-hint" className={hint}>
              {programs.length === 0
                ? 'You have no live program page yet, so your main link uses the standard sign-up.'
                : "Prices and seat numbers come from the program's offer settings, set by an admin."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button type="submit" className={btnPrimary} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
              Save profile
            </button>
            {slug ? (
              <a href={`/join/${encodeURIComponent(slug)}`} target="_blank" rel="noopener noreferrer" className={`${btnSecondary} h-12`}>
                Preview my page
              </a>
            ) : (
              <span className={`${btnSecondary} h-12 opacity-60 cursor-not-allowed`} aria-disabled="true">Preview my page</span>
            )}
          </div>
          <p className={hint}>The preview opens in a new tab and shows what is saved.</p>
        </form>

        <aside className={`${card} flex-[2_1_320px] min-w-0 space-y-3`} aria-label="Preview of the top of your sign-up page">
          <p className="font-bold text-gray-900">Preview: top of your page</p>
          <div className="rounded-xl border border-gray-200 bg-slate-50 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Avatar src={photo} name={name} size="md" />
              <div className="min-w-0">
                <p className="text-xs text-gray-600">Invited by</p>
                <p className="font-bold text-gray-900 truncate">{name}</p>
                <p className="text-xs text-gray-600">NowTransformed {roleWord}</p>
              </div>
            </div>
            {shownWhy ? (
              <p className="text-sm leading-relaxed text-gray-700 break-words">&ldquo;{shownWhy}&rdquo;</p>
            ) : (
              <p className="text-sm text-gray-500 italic">Your &ldquo;why I do this&rdquo; line shows here.</p>
            )}
          </div>
          <p className={hint}>Under-18 prospects and their parents see the same card.</p>
        </aside>
      </div>
    </div>
  )
}
