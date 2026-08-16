'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AlertBanner } from '@/components/ui/alert-banner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CalendarDays, CheckCircle2, Loader2, Video } from 'lucide-react'
import type { ProgramQuestion } from '@/lib/program-question-types'
import { submitQualification } from '@/lib/actions/program-pages'

interface QualificationData {
  programName: string
  zoomUrl: string | null
  zoomInstructions: string | null
  eventDatesText: string | null
  qualificationIntro: string | null
  questions: ProgramQuestion[]
  leadName: string
  alreadySubmitted: boolean
}

type AnswerValue = string | number

export function QualificationClient({
  token,
  data,
}: {
  token: string
  data: QualificationData
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(data.alreadySubmitted)
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({})

  const dates = (data.eventDatesText ?? '')
    .split('\n')
    .map((d) => d.trim())
    .filter(Boolean)

  const setAnswer = (id: string, value: AnswerValue) =>
    setAnswers((prev) => ({ ...prev, [id]: value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const payload = Object.entries(answers).map(([questionId, value]) => ({ questionId, value }))
    startTransition(async () => {
      const result = await submitQualification(token, payload)
      if (result?.error) setError(result.error)
      else setSubmitted(true)
    })
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">
          You are registered, {data.leadName.split(' ')[0]}
        </h1>
        <p className="text-gray-600 mt-2">{data.programName}</p>
      </div>

      {/* Meeting details - always visible, this is what they came for */}
      <Card className="border-primary-200 bg-primary-50">
        <CardContent className="pt-6 space-y-4">
          <h2 className="font-semibold text-gray-900 inline-flex items-center gap-2">
            <Video className="h-5 w-5 text-primary-600" />
            Joining details
          </h2>

          {data.zoomUrl ? (
            <a
              href={data.zoomUrl}
              target="_blank"
              rel="noreferrer"
              className="block break-all rounded-md bg-white border border-primary-200 px-4 py-3 text-primary-700 hover:underline"
            >
              {data.zoomUrl}
            </a>
          ) : (
            <p className="text-gray-600">
              The meeting link will be shared shortly. Please save this page.
            </p>
          )}

          {data.zoomInstructions && (
            <p className="whitespace-pre-wrap text-sm text-gray-700">{data.zoomInstructions}</p>
          )}

          {dates.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-900 inline-flex items-center gap-1.5 mb-1.5">
                <CalendarDays className="h-4 w-4" />
                Upcoming sessions
              </p>
              <ul className="space-y-1 text-sm text-gray-700">
                {dates.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-gray-500">
            Bookmark this page — you can come back to it for the link any time.
          </p>
        </CardContent>
      </Card>

      {submitted ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto mb-3" />
            <h2 className="font-semibold text-gray-900">Thanks, we have your answers</h2>
            <p className="text-gray-600 mt-1">
              Your coach will look through them before the session.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <h2 className="font-semibold text-gray-900">A few quick questions</h2>
            <p className="text-sm text-gray-500 mt-1 mb-4">
              {data.qualificationIntro?.trim() ||
                'This helps your coach make the session useful for you.'}
            </p>

            {error && <AlertBanner variant="error" message={error} className="mb-4" />}

            <form onSubmit={handleSubmit} className="space-y-6" noValidate>
              {data.questions.map((q) => (
                <QuestionField
                  key={q.id}
                  question={q}
                  value={answers[q.id]}
                  onChange={(v) => setAnswer(q.id, v)}
                />
              ))}

              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Submit
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function QuestionField({
  question,
  value,
  onChange,
}: {
  question: ProgramQuestion
  value: AnswerValue | undefined
  onChange: (value: AnswerValue) => void
}) {
  const label = (
    <Label htmlFor={question.id}>
      {question.label}
      {question.required && <span className="text-red-500"> *</span>}
    </Label>
  )

  if (question.type === 'TEXT_LONG') {
    return (
      <div>
        {label}
        <Textarea
          id={question.id}
          rows={4}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    )
  }

  if (question.type === 'DROPDOWN') {
    return (
      <div>
        {label}
        <Select value={(value as string) ?? ''} onValueChange={onChange}>
          <SelectTrigger id={question.id}>
            <SelectValue placeholder="Choose one" />
          </SelectTrigger>
          <SelectContent>
            {(question.options ?? []).map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }

  if (question.type === 'RADIO') {
    return (
      <fieldset>
        <legend className="text-sm font-medium text-gray-900 mb-2">
          {question.label}
          {question.required && <span className="text-red-500"> *</span>}
        </legend>
        <div className="space-y-2">
          {(question.options ?? []).map((opt) => (
            <label key={opt} className="flex items-start gap-2 cursor-pointer">
              <input
                type="radio"
                name={question.id}
                value={opt}
                checked={value === opt}
                onChange={() => onChange(opt)}
                className="mt-1"
              />
              <span className="text-gray-700">{opt}</span>
            </label>
          ))}
        </div>
      </fieldset>
    )
  }

  // LIKERT
  const cfg = question.likert ?? { min: 1, max: 5, minLabel: '', maxLabel: '' }
  const scale: number[] = []
  for (let n = cfg.min; n <= cfg.max; n++) scale.push(n)

  return (
    <fieldset>
      <legend className="text-sm font-medium text-gray-900 mb-2">
        {question.label}
        {question.required && <span className="text-red-500"> *</span>}
      </legend>
      <div className="flex items-center gap-2 flex-wrap">
        {scale.map((n) => (
          <label key={n} className="flex flex-col items-center gap-1 cursor-pointer">
            <input
              type="radio"
              name={question.id}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
            />
            <span className="text-sm text-gray-600 tabular-nums">{n}</span>
          </label>
        ))}
      </div>
      {(cfg.minLabel || cfg.maxLabel) && (
        <div className="flex justify-between text-xs text-gray-500 mt-1 max-w-xs">
          <span>{cfg.minLabel}</span>
          <span>{cfg.maxLabel}</span>
        </div>
      )}
    </fieldset>
  )
}
