'use client'

import { Fragment, useState } from 'react'
import { Megaphone } from 'lucide-react'
import { setLeadAssociation, setLeadFamilyStage } from '@/lib/actions/program-pages'
import {
  AGE_BAND_LABELS,
  AMBASSADOR_ELIGIBLE_BANDS,
  FAMILY_STAGES,
  FAMILY_STAGE_LABELS,
  audienceIncludesChildren,
  type ChildAgeBand,
  type FamilyStage,
} from '@/lib/program-question-types'
import type { ProgramLeadRow } from '@/lib/program-leads'
import type { ProgramOwnerRole } from '@/lib/program-owner'

// The next action for each family follow-up stage. Every step is with the
// parent; the program page promises them nobody contacts the child directly.
const FAMILY_STAGE_TIPS: Record<FamilyStage, string> = {
  NEW: 'Contact the parent within 2 business days, at the time they asked for. Never contact the child directly.',
  PARENT_CONTACTED: 'Book a short intro call with the parent. The child is welcome to join if the parent wants.',
  INTRO_CALL_HELD: 'Cover fit, schedule, costs and sponsorship. If it is a fit, move to enrolling.',
  ENROLLING: 'Create the Ambassador account. Under 18s need the parent’s details, which also sets up their parent account.',
  ENROLLED: 'Enrolled. The parent can follow progress from their own account.',
  NOT_A_FIT: 'Let the parent know kindly, and say when it might suit (for example, once an under-10 turns 10).',
}

// Ambassadors cannot create Ambassador accounts themselves; their coach does.
const AMBASSADOR_ENROLLING_TIP =
  'Ask your coach to create the Ambassador account. Under 18s need the parent’s details, which also sets up their parent account.'

const ASSOCIATION_OPTIONS = [
  { value: 'UNCLASSIFIED', label: 'Unclassified' },
  { value: 'AMBASSADOR', label: 'Prospective Ambassador' },
  { value: 'COACH', label: 'Prospective Coach' },
  { value: 'SERVICE_PROVIDER', label: 'Service Provider' },
  { value: 'BUSINESS_AFFILIATE', label: 'Business Affiliate' },
  { value: 'VOLUNTEER', label: 'Volunteer' },
]

/**
 * The program owner's table of signups: contact details, who it is for,
 * where they got to, and the owner's classification. Shared by the coach's
 * Business Excellence page and the ambassador's program page.
 */
export function ProgramLeadsCard({
  leads,
  contactsHref,
  ownerRole = 'COACH',
}: {
  leads: ProgramLeadRow[]
  /** Where the owner works these people further (coach CRM). Omit when there is none. */
  contactsHref?: string
  ownerRole?: ProgramOwnerRole
}) {
  const stageTip = (stage: FamilyStage) =>
    ownerRole === 'AMBASSADOR' && stage === 'ENROLLING'
      ? AMBASSADOR_ENROLLING_TIP
      : FAMILY_STAGE_TIPS[stage]

  const [expanded, setExpanded] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(leads.map((l) => [l.id, l.association]))
  )
  const [error, setError] = useState('')

  const copyJoiningLink = async (lead: ProgramLeadRow) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${lead.joiningPath}`)
      setCopiedId(lead.id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      setError('Could not copy to clipboard')
    }
  }

  const [stages, setStages] = useState<Record<string, string>>(
    Object.fromEntries(leads.map((l) => [l.id, l.familyStage ?? 'NEW']))
  )

  const handleStageChange = async (leadId: string, stage: string) => {
    setStages((prev) => ({ ...prev, [leadId]: stage }))
    setSaving(leadId)
    setError('')
    const result = await setLeadFamilyStage(leadId, stage)
    if (result?.error) setError(result.error)
    setSaving(null)
  }

  const handleChange = async (leadId: string, association: string) => {
    setValues((prev) => ({ ...prev, [leadId]: association }))
    setSaving(leadId)
    setError('')
    const result = await setLeadAssociation(leadId, association)
    if (result?.error) setError(result.error)
    setSaving(null)
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-6">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-teal-600" />
          <h2 className="text-lg font-semibold text-gray-900">Program Leads</h2>
        </div>
        {contactsHref && (
          <a href={contactsHref} className="text-sm text-primary-600 hover:underline">
            Work these in Contacts &rarr;
          </a>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-4">
        {contactsHref
          ? 'A summary of who has signed up. To see their answers, log a call or set a follow-up, open them in Contacts.'
          : 'Everyone who has signed up on your program page. Contact parents only, never a child directly.'}
      </p>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200">
            <tr>
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">Profession</th>
              <th className="py-2 pr-3">Program</th>
              <th className="py-2 pr-3">Registered</th>
              <th className="py-2 pr-3">Association</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {leads.map((lead) => (
              <Fragment key={lead.id}>
                <tr>
                  <td className="py-3 pr-3">
                    <p className="font-medium text-gray-900">{lead.fullName}</p>
                    <p className="text-gray-500">{lead.email}</p>
                    {lead.phone && <p className="text-gray-500">{lead.phone}</p>}
                    {audienceIncludesChildren(lead.audience) && (
                      <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-xs text-purple-700">
                        Parent
                        {lead.audience === 'BOTH' ? ' - also for themself' : ''}
                      </p>
                    )}
                  </td>
                  <td className="py-3 pr-3 text-gray-700">{lead.profession}</td>
                  <td className="py-3 pr-3 text-gray-700">{lead.programName}</td>
                  <td className="py-3 pr-3 text-gray-600 whitespace-nowrap">
                    {new Date(lead.registeredAt).toLocaleDateString()}
                    {lead.qualifiedAt && (
                      <span className="block text-xs text-green-700">form completed</span>
                    )}
                    {!lead.qualifiedAt && (
                      <span className="block text-xs text-amber-600">
                        {lead.interestedAt ? 'interested - form not completed' : 'has not clicked interested yet'}
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-3">
                    <select
                      value={values[lead.id] ?? 'UNCLASSIFIED'}
                      onChange={(e) => handleChange(lead.id, e.target.value)}
                      disabled={saving === lead.id}
                      aria-label={`Association for ${lead.fullName}`}
                      className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-50"
                    >
                      {ASSOCIATION_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => copyJoiningLink(lead)}
                      className="text-primary-600 hover:underline text-sm mr-3"
                      title="Copy this person's joining link so you can resend it"
                    >
                      {copiedId === lead.id ? 'Copied' : 'Copy link'}
                    </button>
                    {lead.answers.length > 0 && (
                      <button
                        onClick={() => setExpanded(expanded === lead.id ? null : lead.id)}
                        className="text-primary-600 hover:underline text-sm"
                      >
                        {expanded === lead.id ? 'Hide' : 'Answers'}
                      </button>
                    )}
                  </td>
                </tr>
                {audienceIncludesChildren(lead.audience) && (
                  <tr>
                    <td colSpan={6} className="pb-3 pr-3">
                      <div className="rounded-md border border-purple-100 bg-purple-50/50 px-3 py-2.5 flex flex-wrap items-center gap-x-6 gap-y-2">
                        <p className="text-sm text-gray-700">
                          <span className="text-xs uppercase tracking-wide text-gray-500 mr-2">
                            Enquiring for
                          </span>
                          {lead.children.length > 0
                            ? lead.children
                                .map(
                                  (c) =>
                                    `${c.firstName} (${
                                      AGE_BAND_LABELS[c.ageBand as ChildAgeBand] ?? c.ageBand
                                    }${
                                      AMBASSADOR_ELIGIBLE_BANDS.includes(c.ageBand as ChildAgeBand)
                                        ? ', Ambassador age'
                                        : ''
                                    })`
                                )
                                .join(', ')
                            : 'children'}
                        </p>
                        <label className="text-sm text-gray-700 inline-flex items-center gap-2">
                          <span className="text-xs uppercase tracking-wide text-gray-500">
                            Follow-up
                          </span>
                          <select
                            value={stages[lead.id] ?? 'NEW'}
                            onChange={(e) => handleStageChange(lead.id, e.target.value)}
                            disabled={saving === lead.id}
                            className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-50"
                          >
                            {FAMILY_STAGES.map((s) => (
                              <option key={s} value={s}>
                                {FAMILY_STAGE_LABELS[s]}
                              </option>
                            ))}
                          </select>
                        </label>
                        <p className="text-xs text-gray-500 basis-full">
                          {stageTip((stages[lead.id] ?? 'NEW') as FamilyStage)}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
                {expanded === lead.id && (
                  <tr>
                    <td colSpan={6} className="bg-gray-50 px-3 py-4">
                      <dl className="space-y-3">
                        {lead.answers.map((a, i) => (
                          <div key={i}>
                            <dt className="text-xs uppercase tracking-wide text-gray-500">
                              {a.label}
                            </dt>
                            <dd className="text-gray-800 whitespace-pre-wrap">{String(a.value)}</dd>
                          </div>
                        ))}
                      </dl>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
