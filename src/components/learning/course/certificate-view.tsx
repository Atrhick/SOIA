'use client'

import Link from 'next/link'
import { ArrowLeft, Award, Printer } from 'lucide-react'
import { formatMinutes } from '@/lib/lms/course-rules'

export interface CertificateData {
  id: string
  learnerName: string
  courseTitle: string
  courseId: string
  estimatedDuration: number | null
  completedAt: string
}

/** A simple certificate of completion. Prints on one landscape page (Print saves as PDF on phones too). */
export function CertificateView({ certificate, basePath }: { certificate: CertificateData; basePath: string }) {
  const date = new Date(certificate.completedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`${basePath}/${certificate.courseId}`}
          className="inline-flex min-h-[44px] items-center gap-2 text-gray-700 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back to the course
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-blue-700 px-4 font-semibold text-white hover:bg-blue-800"
        >
          <Printer className="h-4 w-4" /> Print or save as PDF
        </button>
      </div>

      <article
        aria-label="Certificate of completion"
        className="mx-auto max-w-3xl rounded-2xl border-[6px] border-double border-blue-900/70 bg-white px-5 py-10 text-center shadow-sm sm:px-12 sm:py-14 print:shadow-none"
      >
        <Award className="mx-auto mb-4 h-14 w-14 text-amber-500" aria-hidden="true" />
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-900">Certificate of completion</p>
        <p className="mt-6 text-gray-700">This certifies that</p>
        <p className="mt-2 break-words font-serif text-3xl font-bold text-gray-900 sm:text-4xl">{certificate.learnerName}</p>
        <p className="mt-6 text-gray-700">has completed the course</p>
        <p className="mt-2 break-words text-xl font-semibold text-gray-900 sm:text-2xl">{certificate.courseTitle}</p>
        {formatMinutes(certificate.estimatedDuration) && (
          <p className="mt-2 text-sm text-gray-600">About {formatMinutes(certificate.estimatedDuration)} of learning</p>
        )}
        <div className="mt-10 grid grid-cols-1 gap-6 text-sm text-gray-700 sm:grid-cols-2">
          <div>
            <p className="font-semibold text-gray-900">{date}</p>
            <p>Date completed</p>
          </div>
          <div>
            <p className="font-semibold text-gray-900">NowTransformed</p>
            <p>Youth leadership development program</p>
          </div>
        </div>
        <p className="mt-8 text-xs text-gray-500">Certificate ID {certificate.id}</p>
      </article>
    </div>
  )
}
