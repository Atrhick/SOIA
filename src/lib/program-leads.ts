// Shapes program leads for the owner's leads table (coach Business Excellence,
// ambassador program page). Pure: dates in, ISO strings out, safe to pass to a
// client component. Not 'use server'.

export interface ProgramLeadRow {
  id: string
  programName: string
  fullName: string
  email: string
  profession: string
  registeredAt: string
  qualifiedAt: string | null
  interestedAt: string | null
  association: string
  audience: string | null
  children: { firstName: string; ageBand: string }[]
  phone: string | null
  familyStage: string | null
  joiningPath: string
  answers: { label: string; value: string | number }[]
}

export interface ProgramLeadSource {
  id: string
  fullName: string
  email: string
  profession: string
  registeredAt: Date
  qualifiedAt: Date | null
  interestedAt: Date | null
  association: string
  audience: string | null
  children: unknown
  phone: string | null
  familyStage: string | null
  token: string
  answers: unknown
}

export interface ProgramWithLeads {
  name: string
  slug: string
  leads: ProgramLeadSource[]
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

export function toProgramLeadRow(
  program: { name: string; slug: string },
  lead: ProgramLeadSource
): ProgramLeadRow {
  return {
    id: lead.id,
    programName: program.name,
    fullName: lead.fullName,
    email: lead.email,
    profession: lead.profession,
    registeredAt: lead.registeredAt.toISOString(),
    qualifiedAt: lead.qualifiedAt?.toISOString() ?? null,
    interestedAt: lead.interestedAt?.toISOString() ?? null,
    association: lead.association,
    audience: lead.audience,
    children: asArray<{ firstName: string; ageBand: string }>(lead.children),
    phone: lead.phone,
    familyStage: lead.familyStage,
    // The owner is the only route back to a lost joining link: the public
    // form deliberately will not re-issue it.
    joiningPath: `/p/${program.slug}/r/${lead.token}`,
    answers: asArray<{ label: string; value: string | number }>(lead.answers),
  }
}

/** Every lead across the given programs, newest signup first. */
export function flattenProgramLeads(programs: ProgramWithLeads[]): ProgramLeadRow[] {
  const rows = programs.flatMap((p) => p.leads.map((lead) => toProgramLeadRow(p, lead)))
  rows.sort((a, b) => b.registeredAt.localeCompare(a.registeredAt))
  return rows
}
