'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowLeft, FileText, FolderOpen, Loader2, PenLine, Upload, X } from 'lucide-react'
import { importCourseFromMarkdown, previewCourseImport } from '@/lib/actions/lms/import'
import { formatMinutes } from '@/lib/lms/course-rules'

type Preview = NonNullable<Awaited<ReturnType<typeof previewCourseImport>>['preview']>
type FileIn = { name: string; content: string }

const EXAMPLE = `# Week 1: Self-awareness and growth mindset
Who am I, and how can I grow? (first paragraph = week description)

## What shapes your thinking        <- each ## starts a lesson
Lesson text in markdown: **bold**, lists, tables, images, > quotes.
> **Tip:** a quote that starts with a bold label shows as a callout.

### Exercise: What shapes you
What is one belief about yourself you picked up from someone else?
[Write here]

Which of these sounds most like you?
[Choose one]
- I avoid hard tasks
- I keep going

Which supports do you have right now?
[Choose all that apply]
- A coach
- Family`

export function CourseImportClient() {
  const router = useRouter()
  const folderInput = useRef<HTMLInputElement>(null)
  const filesInput = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<FileIn[]>([])
  const [preview, setPreview] = useState<Preview | null>(null)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState<'reading' | 'importing' | null>(null)
  const [error, setError] = useState<string | null>(null)

  // React has no prop for folder picking; set the attribute directly.
  useEffect(() => {
    folderInput.current?.setAttribute('webkitdirectory', '')
    folderInput.current?.setAttribute('directory', '')
  }, [])

  const onPick = async (list: FileList | null) => {
    if (!list?.length) return
    setError(null)
    setPreview(null)
    setBusy('reading')
    try {
      const picked = Array.from(list).filter((f) => /\.(md|markdown)$/i.test(f.name))
      const read = await Promise.all(
        picked.map(async (f) => ({ name: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name, content: await f.text() }))
      )
      setFiles(read)
      if (!read.length) {
        setError('No .md files were found in what you chose.')
        return
      }
      const r = await previewCourseImport(read)
      if (r.error) setError(r.error)
      else if (r.preview) {
        setPreview(r.preview)
        setTitle(r.preview.title)
      }
    } catch {
      setError('Could not read those files. Try again.')
    } finally {
      setBusy(null)
      if (folderInput.current) folderInput.current.value = ''
      if (filesInput.current) filesInput.current.value = ''
    }
  }

  const doImport = async () => {
    setBusy('importing')
    setError(null)
    try {
      const r = await importCourseFromMarkdown(files, title)
      if (r.error) setError(r.error)
      else if (r.courseId) router.push(`/admin/lms/${r.courseId}`)
    } catch {
      setError('The import failed and nothing was saved. Try again.')
    } finally {
      setBusy(null)
    }
  }

  const btn =
    'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-4 font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-50'

  return (
    <div className="space-y-6">
      <Link href="/admin/lms" className="inline-flex min-h-[44px] items-center gap-2 text-gray-700 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" /> Back to courses
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Import a course from markdown</h1>
        <p className="text-gray-700">
          Choose a folder of .md files: one file per week becomes one module, and each <code>##</code> heading starts a lesson.
          The course is created as a draft, so you can check it before publishing.
        </p>
      </div>

      {error && (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="flex h-8 w-8 items-center justify-center rounded hover:bg-red-100" aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <section className="rounded-xl border bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={() => folderInput.current?.click()} disabled={!!busy} className={`${btn} bg-blue-700 text-white hover:bg-blue-800`}>
            <FolderOpen className="h-4 w-4" /> Choose a folder
          </button>
          <button type="button" onClick={() => filesInput.current?.click()} disabled={!!busy} className={`${btn} border border-gray-300 text-gray-900 hover:bg-gray-50`}>
            <FileText className="h-4 w-4" /> Choose files
          </button>
          {busy === 'reading' && (
            <span className="flex items-center gap-2 text-gray-700">
              <Loader2 className="h-4 w-4 animate-spin" /> Reading files...
            </span>
          )}
        </div>
        <input ref={folderInput} type="file" multiple className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => onPick(e.target.files)} />
        <input ref={filesInput} type="file" multiple accept=".md,.markdown,text/markdown" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => onPick(e.target.files)} />
        {files.length > 0 && <p className="mt-3 text-sm text-gray-700">{files.length} markdown file(s) read.</p>}
      </section>

      {preview && (
        <section className="space-y-4 rounded-xl border bg-white p-5">
          <h2 className="text-lg font-semibold text-gray-900">Check before importing</h2>
          <div>
            <label htmlFor="imp-title" className="mb-1 block text-sm font-medium text-gray-900">
              Course title
            </label>
            <input
              id="imp-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              className="min-h-[44px] w-full rounded-lg border border-gray-300 px-3 text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
            />
          </div>
          <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div><dt className="inline font-medium text-gray-900">For: </dt><dd className="inline text-gray-700">{preview.allowedRoles.map((r) => (r === 'COACH' ? 'Coaches' : 'Ambassadors')).join(', ')}</dd></div>
            <div><dt className="inline font-medium text-gray-900">Category: </dt><dd className="inline text-gray-700">{preview.category || 'none'}</dd></div>
            <div><dt className="inline font-medium text-gray-900">New week every: </dt><dd className="inline text-gray-700">{preview.dripDays ? `${preview.dripDays} days` : 'all open at once'}</dd></div>
            <div><dt className="inline font-medium text-gray-900">Length: </dt><dd className="inline text-gray-700">{formatMinutes(preview.estimatedDuration) || 'unknown'}</dd></div>
            <div className="sm:col-span-2"><dt className="inline font-medium text-gray-900">What you&apos;ll learn: </dt><dd className="inline text-gray-700">{preview.outcomes.length ? `${preview.outcomes.length} lines` : 'none yet'}</dd></div>
          </dl>

          {preview.warnings.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="mb-1 flex items-center gap-2 font-semibold text-amber-900">
                <AlertTriangle className="h-4 w-4" /> Worth a look
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900">
                {preview.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <ol className="space-y-3">
            {preview.modules.map((m, i) => (
              <li key={i} className="rounded-lg border p-3">
                <p className="font-semibold text-gray-900">{m.title}</p>
                <p className="text-xs text-gray-600">from {m.sourceFile}</p>
                <ul className="mt-2 space-y-1 text-sm text-gray-800">
                  {m.lessons.map((l, j) => (
                    <li key={j} className="flex flex-wrap items-center gap-x-2">
                      <span>{j + 1}. {l.title}</span>
                      <span className="text-gray-600">{l.estimatedDuration} min</span>
                      {l.exercises > 0 && (
                        <span className="flex items-center gap-1 text-indigo-800">
                          <PenLine className="h-3 w-3" /> {l.exercises} exercise{l.exercises > 1 ? 's' : ''}, {l.prompts} questions
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>

          <button type="button" onClick={doImport} disabled={!!busy || !title.trim()} className={`${btn} w-full bg-green-700 text-white hover:bg-green-800 sm:w-auto`}>
            {busy === 'importing' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Create the draft course
          </button>
        </section>
      )}

      <section className="rounded-xl border bg-white p-5">
        <h2 className="mb-2 text-lg font-semibold text-gray-900">How to write the files</h2>
        <ul className="mb-3 list-disc space-y-1 pl-5 text-gray-800">
          <li>Files are read in name order: <code>week-01.md</code>, <code>week-02.md</code>, and so on.</li>
          <li>
            Optional <code>course.md</code>: <code># Title</code>, a description, <code>## What you&apos;ll learn</code> (a list),{' '}
            <code>## Who it&apos;s for</code>, and <code>## Details</code> with lines like <code>Category: Leadership</code>,{' '}
            <code>Tags: ambassadors, workbook</code>, <code>Roles: Ambassadors</code>, <code>Drip days: 7</code>.
          </li>
          <li>
            A <code>###</code> section with <code>[Write here]</code>, <code>[Choose one]</code> or <code>[Choose all that apply]</code> becomes an
            exercise learners answer in the app. The line just above each marker is the question; options are the list lines under a Choose marker.
          </li>
        </ul>
        <pre className="overflow-x-auto rounded-lg bg-gray-50 p-3 text-xs text-gray-800">{EXAMPLE}</pre>
      </section>
    </div>
  )
}
