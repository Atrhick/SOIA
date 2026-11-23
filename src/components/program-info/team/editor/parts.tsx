'use client'

/**
 * The page editor's parts: which fields each part has (limits from OfferPageSchema), which of the owner's
 * answers feed it, and the fields themselves.
 */
import type { ReactNode } from 'react'
import { SPONSORSHIP_LINE } from '@/lib/program-info/page-checks'
import { DEFAULT_OFFER_THEME } from '@/lib/get-involved/offer-page'
import { kit } from '@/components/ui/kit/styles'
import { CheckField, GroupProblems, ImageField, IncludeSwitch, ListField, NumberField, TextField, fieldId, smallBtn, useEditor } from './fields'
import { NEW_PART, emptyImage, getAt, type Path } from './model'

export interface PartDef {
  id: string
  label: string
  /** The page keys this part edits (to find its problems). */
  keys: string[]
  /** The owner's answers that feed it (INFO_SECTIONS question ids). */
  answers: string[]
}

export const PARTS: PartDef[] = [
  { id: 'top', label: 'Top of the page', keys: ['eyebrow', 'hook', 'intro', 'hostNote', 'heroImage', 'bullets'], answers: ['summary', 'offerings', 'audience'] },
  { id: 'why', label: 'Why it matters', keys: ['why'], answers: ['problem', 'moments'] },
  { id: 'sponsorship', label: 'Sponsorship box', keys: ['sponsorship'], answers: ['cost', 'audience'] },
  { id: 'options', label: '"Is this you?" cards', keys: ['options'], answers: ['audience', 'moments', 'offerings'] },
  { id: 'callout', label: 'Business callout', keys: ['callout'], answers: ['audience', 'offerings'] },
  { id: 'showcase', label: 'Showcase', keys: ['showcase'], answers: ['offerings', 'flyerLink'] },
  { id: 'story', label: 'The story', keys: ['story'], answers: ['aboutYou', 'photosLink'] },
  { id: 'steps', label: 'How it works', keys: ['steps'], answers: ['howItRuns', 'zoomUrl'] },
  { id: 'gallery', label: 'Photos row', keys: ['gallery'], answers: ['photosLink'] },
  { id: 'testimonials', label: 'What people say', keys: ['testimonials'], answers: ['quote', 'quotePermission'] },
  { id: 'faqs', label: 'Questions', keys: ['faqs'], answers: ['faqs', 'cost'] },
  { id: 'closing', label: 'Closing', keys: ['closing', 'partnerLine'], answers: ['summary'] },
  { id: 'theme', label: 'Colours', keys: ['theme'], answers: ['flyerLink', 'photosLink'] },
]

/** Which part a problem's path belongs to. */
export function partOfPath(path: string): string {
  const first = path.split('.')[0]
  return PARTS.find((p) => p.keys.includes(first))?.id ?? 'top'
}

/** Optional parts: "off" in the parts list when left out. */
export const OPTIONAL_PARTS = new Set(['why', 'options', 'callout', 'showcase', 'story', 'gallery', 'theme'])

const Stack = ({ children }: { children: ReactNode }) => <div className="flex min-w-0 flex-col gap-4">{children}</div>

/** Shows its fields only while the part is switched on. */
function WhenOn({ path, children }: { path: Path; children: ReactNode }) {
  const { page } = useEditor()
  return getAt(page, path) === undefined ? <p className="m-0 text-sm text-gray-700">This part is switched off, so it is not on the page.</p> : <Stack>{children}</Stack>
}

const PointFields = ({ p, leadMax = 60, textMax = 200, textRequired = true }: { p: Path; leadMax?: number; textMax?: number; textRequired?: boolean }) => (
  <>
    <TextField path={[...p, 'lead']} label="Bold start" max={leadMax} />
    <TextField path={[...p, 'text']} label="Rest of the line" max={textMax} required={textRequired ? undefined : false} />
  </>
)

const Paragraphs = ({ path }: { path: Path }) => (
  <ListField path={path} title="Paragraphs" noun="paragraph" min={1} max={3} make={() => ''} render={(p, i) => <TextField path={p} label={`Paragraph ${i + 1}`} max={600} multiline rows={5} />} />
)

function OptionalImage({ path, label, withNote }: { path: Path; label: string; withNote?: boolean }) {
  const { page } = useEditor()
  return (
    <>
      <IncludeSwitch path={path} label={`Show ${label.toLowerCase()}`} make={emptyImage} />
      {getAt(page, path) !== undefined && <ImageField path={path} label={label} withNote={withNote} />}
    </>
  )
}

function SponsorshipText() {
  const { page, set } = useEditor()
  const text = getAt(page, ['sponsorship', 'text'])
  const has = typeof text === 'string' && text.includes(SPONSORSHIP_LINE)
  return (
    <div className="flex flex-col gap-2">
      <TextField
        path={['sponsorship', 'text']}
        label="Text"
        max={500}
        multiline
        rows={5}
        hint={<>Must include, word for word: “{SPONSORSHIP_LINE}” No prices, and say “sponsorship”, never “seat” or “grant”.</>}
      />
      {!has && (
        <button type="button" className={`${smallBtn} self-start`} onClick={() => set(['sponsorship', 'text'], `${SPONSORSHIP_LINE} ${typeof text === 'string' ? text : ''}`.trim())}>
          Put the sponsorship sentence back
        </button>
      )}
    </div>
  )
}

function ColourField({ k, label }: { k: keyof typeof DEFAULT_OFFER_THEME; label: string }) {
  const { page, set } = useEditor()
  const path: Path = ['theme', k]
  const v = getAt(page, path)
  const value = typeof v === 'string' ? v : ''
  const ok = /^#[0-9a-fA-F]{6}$/.test(value)
  const id = fieldId(path)
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className={kit.label}>{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" aria-label={`${label}: pick a colour`} value={ok ? value : '#000000'} onChange={(e) => set(path, e.target.value)} className="h-12 w-14 flex-none cursor-pointer rounded-lg border border-gray-300 bg-white p-1" />
        <input id={id} value={value} onChange={(e) => set(path, e.target.value)} aria-describedby={`${id}-problems`} className={`${kit.input} min-w-0`} />
      </div>
      <GroupProblems path={path} />
    </div>
  )
}

function ThemeFields() {
  const { page, set } = useEditor()
  const on = getAt(page, ['theme']) !== undefined
  return (
    <Stack>
      <p className="m-0 text-base text-gray-800">{on ? 'This page uses its own colours.' : 'This page uses the standard NowTRANSFORMED blue.'}</p>
      <div className="flex flex-wrap gap-2">
        {!on && <button type="button" className={smallBtn} onClick={() => set(['theme'], NEW_PART.theme())}>Use our own colours</button>}
        {on && <button type="button" className={smallBtn} onClick={() => set(['theme'], undefined)}>Use standard blue</button>}
      </div>
      {on && (
        <>
          <p className="m-0 text-sm text-gray-600">Pick a button colour that is dark enough to read white text on, and a light top background.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ColourField k="accent" label="Buttons and links" />
            <ColourField k="accentDark" label="Button when pointed at" />
            <ColourField k="tint" label="Top background" />
            <ColourField k="deep" label="Dark band (closing)" />
            <ColourField k="deepText" label="Text on the dark band" />
          </div>
        </>
      )}
    </Stack>
  )
}

/** The fields of one part. */
export function PartFields({ id }: { id: string }) {
  switch (id) {
    case 'top':
      return (
        <Stack>
          <TextField path={['eyebrow']} label="Small line above the headline" max={120} required={false} hint="e.g. For families who want a plan" />
          <TextField path={['hook']} label="Headline" max={120} />
          <TextField path={['intro']} label="Opening paragraph" max={600} multiline rows={5} />
          <TextField path={['hostNote']} label="Line under the host's name" max={120} required={false} hint="e.g. runs ExploreNation's weekly intro sessions" />
          <IncludeSwitch path={['heroImage']} label="Show a main photo" make={emptyImage} />
          <HeroImage />
          <ListField
            path={['bullets']}
            title="Points beside the headline"
            noun="point"
            max={4}
            make={() => ({ lead: '', text: '' })}
            hint="One of them must mention the sponsorship."
            render={(p) => <PointFields p={p} textRequired={false} />}
          />
        </Stack>
      )
    case 'why':
      return (
        <Stack>
          <IncludeSwitch path={['why']} label="Include this part" make={NEW_PART.why} />
          <WhenOn path={['why']}>
            <TextField path={['why', 'title']} label="Title" max={120} />
            <Paragraphs path={['why', 'paragraphs']} />
          </WhenOn>
        </Stack>
      )
    case 'sponsorship':
      return <SponsorshipFields />
    case 'options':
      return (
        <Stack>
          <IncludeSwitch path={['options']} label="Include this part" make={NEW_PART.options} />
          <WhenOn path={['options']}>
            <TextField path={['options', 'title']} label="Title" max={120} hint="e.g. Is this you?" />
            <ListField
              path={['options', 'items']}
              title="Cards"
              noun="card"
              min={1}
              max={4}
              make={() => ({ label: '', title: '', text: '' })}
              render={(p) => (
                <>
                  <TextField path={[...p, 'label']} label="Small label" max={40} />
                  <TextField path={[...p, 'title']} label="Title" max={80} />
                  <TextField path={[...p, 'text']} label="Text" max={400} multiline />
                  <OptionalImage path={[...p, 'image']} label="A photo" withNote />
                  <CheckField path={[...p, 'featured']} label="Highlight this card" />
                </>
              )}
            />
            <TextField path={['options', 'footnote']} label="Small print under the cards" max={200} required={false} />
            <TextField path={['options', 'cta']} label="Button text" max={60} required={false} />
            <IncludeSwitch path={['options', 'soon']} label='Add a "coming soon" note' make={() => ({ label: '', text: '', images: [] })} hint="Something planned but not on offer yet, e.g. a printed magazine." />
            <SoonFields />
          </WhenOn>
        </Stack>
      )
    case 'callout':
      return (
        <Stack>
          <IncludeSwitch path={['callout']} label="Include this part" make={NEW_PART.callout} hint='A short side section for a second group, e.g. "Own a small business?"' />
          <WhenOn path={['callout']}>
            <TextField path={['callout', 'eyebrow']} label="Small line above the title" max={60} required={false} />
            <TextField path={['callout', 'title']} label="Title" max={120} />
            <TextField path={['callout', 'text']} label="Text" max={500} multiline />
            <ListField path={['callout', 'points']} title="Points" noun="point" max={3} make={() => ({ lead: '', text: '' })} render={(p) => <PointFields p={p} />} />
            <OptionalImage path={['callout', 'image']} label="A photo" withNote />
            <TextField path={['callout', 'cta']} label="Button text" max={60} required={false} />
          </WhenOn>
        </Stack>
      )
    case 'showcase':
      return (
        <Stack>
          <IncludeSwitch path={['showcase']} label="Include this part" make={NEW_PART.showcase} hint="Screenshots of what people get, with numbered pins. Most pages leave this off." />
          <WhenOn path={['showcase']}>
            <details className="rounded-xl border border-gray-200 p-3">
              <summary className="flex min-h-[44px] cursor-pointer items-center text-base font-bold text-gray-900">Showcase fields (advanced)</summary>
              <div className="mt-3 flex flex-col gap-4">
                <TextField path={['showcase', 'eyebrow']} label="Small line above the title" max={60} required={false} />
                <TextField path={['showcase', 'title']} label="Title" max={120} />
                <ImageField path={['showcase', 'desktop']} label="Computer screenshot" />
                <OptionalImage path={['showcase', 'phone']} label="A phone screenshot" />
                <ListField path={['showcase', 'pins']} title="Numbered pins on the screenshot" noun="pin" max={4} make={() => ({ left: 50, top: 50 })} hint="Matched to the points below by order. Percent from the top left." render={(p) => (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <NumberField path={[...p, 'left']} label="From the left (%)" min={0} max={100} />
                    <NumberField path={[...p, 'top']} label="From the top (%)" min={0} max={100} />
                  </div>
                )} />
                <ListField path={['showcase', 'points']} title="Points" noun="point" max={4} make={() => ({ title: '', text: '' })} render={(p) => (
                  <>
                    <TextField path={[...p, 'title']} label="Title" max={80} />
                    <TextField path={[...p, 'text']} label="Text" max={300} multiline />
                  </>
                )} />
                <TextField path={['showcase', 'caption']} label="Caption" max={200} required={false} />
              </div>
            </details>
          </WhenOn>
        </Stack>
      )
    case 'story':
      return (
        <Stack>
          <IncludeSwitch path={['story']} label="Include this part" make={NEW_PART.story} />
          <WhenOn path={['story']}>
            <TextField path={['story', 'title']} label="Title" max={120} />
            <Paragraphs path={['story', 'paragraphs']} />
            <OptionalImage path={['story', 'image']} label="A photo" />
          </WhenOn>
        </Stack>
      )
    case 'steps':
      return (
        <Stack>
          <ListField path={['steps']} title="Steps" noun="step" min={1} max={4} make={() => ({ title: '', text: '' })} hint="Every page has at least one step." render={(p) => (
            <>
              <TextField path={[...p, 'title']} label="Title" max={60} />
              <TextField path={[...p, 'text']} label="Text" max={300} multiline />
            </>
          )} />
        </Stack>
      )
    case 'gallery':
      return (
        <Stack>
          <IncludeSwitch path={['gallery']} label="Include this part" make={NEW_PART.gallery} />
          <WhenOn path={['gallery']}>
            <TextField path={['gallery', 'title']} label="Title" max={120} />
            <TextField path={['gallery', 'text']} label="Text" max={300} multiline required={false} />
            <ListField path={['gallery', 'images']} title="Photos" noun="photo" min={1} max={5} make={emptyImage} render={(p, i) => <ImageField path={p} label={`Photo ${i + 1}`} />} />
            <TextField path={['gallery', 'caption']} label="Caption" max={200} required={false} />
          </WhenOn>
        </Stack>
      )
    case 'testimonials':
      return (
        <Stack>
          <ListField
            path={['testimonials']}
            title="Quotes"
            noun="quote"
            max={3}
            make={() => ({ quote: '', name: '' })}
            hint="Leave this empty to hide the part. Only real quotes, with the person's OK to use their words and first name."
            render={(p) => (
              <>
                <TextField path={[...p, 'quote']} label="Quote" max={500} multiline />
                <TextField path={[...p, 'name']} label="Name" max={80} />
                <TextField path={[...p, 'role']} label="Who they are" max={120} required={false} hint="e.g. Parent of a 15-year-old" />
                <ImageField path={[...p, 'photo']} label="Small photo of them (optional)" noAlt />
              </>
            )}
          />
        </Stack>
      )
    case 'faqs':
      return (
        <Stack>
          <ListField path={['faqs']} title="Questions and answers" noun="question" max={8} make={() => ({ q: '', a: '' })} hint="Leave this empty to hide the part." render={(p) => (
            <>
              <TextField path={[...p, 'q']} label="Question" max={120} />
              <TextField path={[...p, 'a']} label="Answer" max={800} multiline rows={5} />
            </>
          )} />
        </Stack>
      )
    case 'closing':
      return (
        <Stack>
          <TextField path={['closing', 'title']} label="Title" max={120} />
          <TextField path={['closing', 'text']} label="Text" max={200} multiline required={false} />
          <TextField path={['closing', 'cta']} label="Button text" max={40} hint="e.g. Book my free call" />
          <TextField path={['partnerLine']} label="Partner line in the footer" max={120} required={false} hint="e.g. in partnership with ExploreNation" />
        </Stack>
      )
    case 'theme':
      return <ThemeFields />
    default:
      return null
  }
}

function HeroImage() {
  const { page } = useEditor()
  if (getAt(page, ['heroImage']) === undefined) return null
  return <ImageField path={['heroImage']} label="Main photo" withNote withHandNote />
}

function SoonFields() {
  const { page } = useEditor()
  if (getAt(page, ['options', 'soon']) === undefined) return null
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-dashed border-gray-300 p-3">
      <TextField path={['options', 'soon', 'label']} label="Label" max={30} hint="e.g. Also planned: print" />
      <TextField path={['options', 'soon', 'text']} label="Text" max={200} multiline />
      <ListField path={['options', 'soon', 'images']} title="Photos" noun="photo" max={3} make={emptyImage} render={(p, i) => <ImageField path={p} label={`Photo ${i + 1}`} withNote />} />
    </div>
  )
}

function SponsorshipMissing() {
  const { set } = useEditor()
  return (
    <button
      type="button"
      className={`${smallBtn} self-start`}
      onClick={() => set(['sponsorship'], { title: '', text: SPONSORSHIP_LINE, points: [{ lead: '', text: '' }, { lead: '', text: '' }, { lead: '', text: '' }], cta: '' })}
    >
      Add the sponsorship box
    </button>
  )
}

function SponsorshipFields() {
  const { page } = useEditor()
  return (
        <Stack>
          <GroupProblems path={['sponsorship']} />
          <p className="m-0 text-sm text-gray-700">Every page has this box, right after &quot;Why it matters&quot;.</p>
          {getAt(page, ['sponsorship']) === undefined ? (
            <SponsorshipMissing />
          ) : (
            <>
              <TextField path={['sponsorship', 'title']} label="Title" max={120} />
              <SponsorshipText />
              <ListField path={['sponsorship', 'points']} title="Points" noun="point" max={3} make={() => ({ lead: '', text: '' })} hint="Exactly 3 points: who it is for, what it covers, how to find out." render={(p) => <PointFields p={p} />} />
              <TextField path={['sponsorship', 'cta']} label="Button text" max={40} hint="e.g. See if I qualify" />
            </>
          )}
        </Stack>
  )
}
