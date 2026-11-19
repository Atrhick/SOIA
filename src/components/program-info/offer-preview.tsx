/**
 * A10: the REAL landing page (OfferLanding) for a version's offerPage, as visitors will see it, in preview
 * mode: no "Back to my dashboard" bar, no <main> of its own, and the sign-up form switched off (a disabled
 * fieldset, so no one can sign up from a preview). The phone "Book my free call" bar stays inside the frame
 * (the transform makes the frame the containing block for fixed elements). Server component, shared by the
 * owner (coach/ambassador) screens, the team screens and the full-size frame route (/page-preview/[id]).
 */
import { OfferLanding } from '@/components/get-involved/offer-landing/offer-landing'
import type { SignupPageProps } from '@/components/get-involved/signup/signup-page'
import { parseOfferPage } from '@/lib/get-involved/offer-page'
import type { PageDetail } from '@/lib/program-info/server'
import { loadSignupPage } from '@/app/(landing)/join/[slug]/load'
import { ScaledPreviewFrame } from './scaled-preview-frame'

export type PreviewPageInfo = Pick<PageDetail, 'ownerUserId' | 'ownerRole' | 'ownerName' | 'ownerFirstName' | 'slug' | 'programName' | 'companyName'>

async function previewSignup(d: PreviewPageInfo): Promise<SignupPageProps> {
  const program = { slug: d.slug, label: d.programName, headline: null, bullets: [] }
  const full = d.ownerName ?? 'Your name'
  const fallback: SignupPageProps = {
    slug: 'preview', via: null, inv: null,
    inviter: {
      name: full,
      first: d.ownerFirstName ?? full.split(/\s+/)[0],
      roleLabel: d.ownerRole === 'AMBASSADOR' ? 'NowTransformed ambassador' : 'NowTransformed coach',
      photoUrl: null,
      initials: full.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => (w?.[0] || '?').toUpperCase()).join('') || '?',
      why: null,
    },
    program, offer: null, smsOn: false, mailingAddress: '',
  }
  if (!d.ownerUserId || !d.ownerRole) return fallback
  try {
    const s = await loadSignupPage({ id: d.ownerUserId, role: d.ownerRole }, 'preview', d.slug, null)
    return { ...s, program }
  } catch {
    return fallback
  }
}

export async function OfferPreview({ offerPage, page: info }: { offerPage: unknown; page: PreviewPageInfo }) {
  const page = parseOfferPage(offerPage)
  if (!page) {
    return <p className="m-0 rounded-xl border border-amber-300 bg-amber-50 p-4 text-base text-amber-900">This page does not match the page format, so it cannot be shown. Load it again with the save-draft script.</p>
  }
  const signup = await previewSignup(info)
  return (
    <div className="relative overflow-hidden bg-white [transform:translateZ(0)]" aria-label="Preview of the page" role="region">
      <fieldset disabled className="m-0 min-w-0 border-0 p-0" aria-label="Sign-up form (switched off in the preview)">
        <OfferLanding signup={{ ...signup, embedded: true }} page={page} business={info.companyName || 'NowTRANSFORMED'} more={[]} preview />
      </fieldset>
    </div>
  )
}

/**
 * Phones: the page inline (the phone layout, as phone visitors see it). Computer (lg+): the full-size frame
 * route at 1280px scaled into the column, so the column shows the real desktop layout.
 */
export async function ResponsiveOfferPreview({ offerPage, page, frameSrc, title, maxHeight }: {
  offerPage: unknown
  page: PreviewPageInfo
  /** pageFramePath(pageId, versionNumber) */
  frameSrc: string
  title: string
  /** Computer only: a scroll box this tall (px) instead of the whole page. */
  maxHeight?: number
}) {
  return (
    <>
      <div className="lg:hidden"><OfferPreview offerPage={offerPage} page={page} /></div>
      <div className="hidden lg:block"><ScaledPreviewFrame src={frameSrc} title={title} maxHeight={maxHeight} /></div>
    </>
  )
}
