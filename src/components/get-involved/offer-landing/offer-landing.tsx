/**
 * An offering's landing page (/join/[inviter]/[program] when the program has an offerPage).
 * Server component; the sign-up form in the hero is the real One-A-Day form (SignupPage, embedded),
 * and every button on the page jumps to it (#get-started).
 *
 * Rules carried over from the sign-up page: no prices or sponsorship counts before the call, the
 * sponsorship box unless the program's monthly sponsorships are all offered, testimonials only when real ones exist.
 */
/* eslint-disable @next/next/no-img-element -- static screenshots; plain <img> keeps them lazy and simple */
import Image from 'next/image'
import { Caveat } from 'next/font/google'
import { ArrowRight, Check } from 'lucide-react'
import { BackToAppBar } from '@/components/back-to-app-bar'
import { SignupPage, type SignupPageProps } from '@/components/get-involved/signup/signup-page'
import { DEFAULT_OFFER_THEME, type OfferPage } from '@/lib/get-involved/offer-page'
import s from './offer-landing.module.css'

const caveat = Caveat({ subsets: ['latin'], weight: '700', display: 'swap' })

export interface OfferLandingProps {
  signup: SignupPageProps
  page: OfferPage
  business: string
  more: { label: string; href: string }[]
}

const btn = 'inline-flex items-center justify-center gap-2 min-h-[52px] rounded-xl bg-[var(--lp-accent)] px-7 text-[17px] font-bold text-white no-underline hover:bg-[var(--lp-accent-dark)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-amber-500'
const btnLight = 'inline-flex items-center justify-center gap-2 min-h-[52px] rounded-xl bg-white px-7 text-[17px] font-bold text-[var(--lp-deep)] no-underline hover:bg-[var(--lp-tint)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-amber-500'
const h2 = 'text-[30px] leading-tight font-extrabold text-slate-900'
const body = 'text-lg leading-relaxed text-slate-700'
const eyebrowCls = 'text-sm font-bold uppercase tracking-[.08em] text-[var(--lp-accent)]'
const TILTS = [s.tiltA, s.tiltB, s.tiltC, s.tiltA]

export function OfferLanding({ signup, page, business, more }: OfferLandingProps) {
  const { inviter, program, offer } = signup
  const label = program?.label ?? business
  // Shown whenever the page has a sponsorship box (the wording promises nothing). Hidden only when the
  // program has a monthly number of sponsorships set and this month's are all offered.
  const sponsorshipsOpen = !!page.sponsorship && (!offer || offer.seatsOpen)
  const hand = `${caveat.className} ${s.hand}`
  const t = page.theme ?? DEFAULT_OFFER_THEME
  // The page's colours, as CSS variables; the embedded sign-up form picks them up too (offer-landing.module.css).
  const themeVars = { '--lp-accent': t.accent, '--lp-accent-dark': t.accentDark, '--lp-tint': t.tint, '--lp-deep': t.deep, '--lp-deep-text': t.deepText } as React.CSSProperties

  return (
    <div className={`${s.root} min-h-screen bg-white text-slate-900`} style={themeVars}>
      <BackToAppBar />
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1120px] items-center justify-between gap-4 px-5 py-3">
          <Image src="/brand/nowtransformed-logo.png" alt="NowTRANSFORMED" width={800} height={201} priority className="h-10 w-auto sm:h-12" />
          <a href="#get-started" className="inline-flex min-h-[44px] items-center text-[15px] font-semibold text-[var(--lp-accent)] hover:text-[var(--lp-accent-dark)]">Book a free call</a>
        </div>
      </header>

      <main>
        {/* Hero: the hook on the left, the real sign-up form on the right */}
        <section aria-labelledby="hero-h" className="bg-[var(--lp-tint)]">
          <div className="mx-auto flex max-w-[1120px] flex-wrap items-start gap-10 px-5 pb-14 pt-12">
            <div className="flex min-w-0 flex-[1_1_440px] flex-col gap-[18px]">
              {page.eyebrow && <p className={`m-0 ${eyebrowCls}`}>{page.eyebrow}</p>}
              <h1 id="hero-h" className="m-0 text-[clamp(34px,5vw,52px)] font-extrabold leading-[1.08] tracking-[-0.02em]">{page.hook}</h1>
              <p className="m-0 text-[19px] leading-[1.55] text-slate-700">{page.intro}</p>
              {page.bullets.length > 0 && (
                <ul className="m-0 flex list-none flex-col gap-3 p-0 text-[17px] leading-normal">
                  {page.bullets.map((b) => (
                    <li key={b.lead} className="flex gap-3">
                      <Check className="mt-0.5 h-[22px] w-[22px] flex-none text-[var(--lp-accent)]" strokeWidth={2.5} aria-hidden />
                      <span><strong>{b.lead}</strong>{b.text ? ` ${b.text}` : ''}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex items-center gap-3 pt-1.5">
                {inviter.photoUrl ? (
                  <img src={inviter.photoUrl} alt={`Photo of ${inviter.name}`} className="h-[52px] w-[52px] flex-none rounded-full object-cover" />
                ) : (
                  <div aria-hidden className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-full bg-[var(--lp-accent)] text-xl font-extrabold text-white">{inviter.initials}</div>
                )}
                <p className="m-0 text-[15px] leading-snug text-slate-700">
                  <strong className="text-slate-900">Hosted by {inviter.first}</strong>
                  <br />
                  {inviter.roleLabel}{page.hostNote ? ` · ${page.hostNote}` : ''}
                </p>
              </div>
            </div>

            <div className="min-w-0 max-w-[460px] flex-[1_1_340px]">
              {page.heroImage && (
                <div className="relative">
                  <div className={s.peek}>
                    {page.heroImage.sample && <span className={s.sample}>SAMPLE</span>}
                    <img src={page.heroImage.src} alt={page.heroImage.alt} style={page.heroImage.focus ? { objectPosition: page.heroImage.focus } : undefined} />
                  </div>
                  {page.heroImage.handNote && <p className={`${hand} ${s.peekNote}`}>{page.heroImage.handNote}</p>}
                </div>
              )}
              <div id="get-started" className="relative z-[2] scroll-mt-4">
                <SignupPage {...signup} embedded />
              </div>
            </div>
          </div>
        </section>

        {/* Where it shows up: a desktop screenshot with numbered pins, and the same on a phone */}
        {page.showcase && (
          <section aria-labelledby="where-h" className="mx-auto max-w-[1120px] px-5 pb-[72px] pt-14">
            {page.showcase.eyebrow && <p className={`mb-1.5 text-center ${eyebrowCls}`}>{page.showcase.eyebrow}</p>}
            <h2 id="where-h" className={`mb-[30px] text-center ${h2}`}>{page.showcase.title}</h2>
            <div className="flex flex-wrap items-center gap-x-10 gap-y-12">
              <div className={`relative min-w-0 flex-[3_1_520px] ${page.showcase.phone ? s.withPhone : ''}`}>
                <div className={s.browserWrap}>
                  <div className={s.browser}>
                    <div className={s.browserBar} aria-hidden><i /><i /><i /></div>
                    <div className="relative">
                      <span className={`${s.sample} ${s.sampleBottom}`}>SAMPLE BUSINESSES</span>
                      <img src={page.showcase.desktop.src} alt={page.showcase.desktop.alt} className="block h-auto w-full" loading="lazy" />
                      {page.showcase.pins.map((p, i) => (
                        <span key={i} className={s.pin} style={{ left: `${p.left}%`, top: `${p.top}%` }} aria-hidden>{i + 1}</span>
                      ))}
                    </div>
                  </div>
                </div>
                {page.showcase.phone && (
                  <div className={`${s.phone} ${s.showPhone}`}><img src={page.showcase.phone.src} alt={page.showcase.phone.alt} loading="lazy" /></div>
                )}
              </div>
              {page.showcase.points.length > 0 && (
                <ol className="m-0 flex min-w-0 flex-[2_1_300px] list-none flex-col gap-5 p-0">
                  {page.showcase.points.map((pt, i) => (
                    <li key={pt.title} className="flex gap-3.5">
                      {page.showcase!.pins.length > 0 && <span className={`${s.pin} ${s.pinStatic}`} aria-hidden>{i + 1}</span>}
                      <div>
                        <h3 className="m-0 mb-1 text-lg font-bold">{pt.title}</h3>
                        <p className="m-0 text-base leading-relaxed text-slate-700">{pt.text}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
            {page.showcase.caption && <p className="mt-14 text-center text-sm text-slate-600">{page.showcase.caption}</p>}
          </section>
        )}

        {page.why && (
          <section aria-labelledby="why-h" className="mx-auto max-w-[760px] px-5 py-12">
            <h2 id="why-h" className={`mb-3.5 ${h2}`}>{page.why.title}</h2>
            {page.why.paragraphs.map((p) => <p key={p} className={`mb-3 ${body}`}>{p}</p>)}
          </section>
        )}

        {/* The options, each with a tilted screenshot */}
        {page.options && (
          <section aria-labelledby="get-h" className="border-y border-slate-200 bg-slate-50">
            <div className="mx-auto max-w-[1120px] px-5 py-14">
              <h2 id="get-h" className={`mb-[70px] text-center ${h2}`}>{page.options.title}</h2>
              <div className="flex flex-wrap gap-x-5 gap-y-16">
                {page.options.items.map((o, i) => (
                  <div key={o.title} className={`min-w-0 rounded-2xl bg-white p-[22px] ${page.options!.items.length === 4 ? s.optHalf : 'flex-[1_1_280px]'} ${o.featured ? 'border-2 border-[var(--lp-accent)]' : 'border border-slate-200'}`}>
                    {o.image && (
                      <div className={`${s.polaroid} ${TILTS[i % TILTS.length]}`}>
                        {o.image.sample && <span className={s.sample}>SAMPLE</span>}
                        <img src={o.image.src} alt={o.image.alt} loading="lazy" style={o.image.focus ? { objectPosition: o.image.focus } : undefined} />
                        {o.image.note && <span className={hand}>{o.image.note}</span>}
                      </div>
                    )}
                    <p className="mb-1.5 text-sm font-bold uppercase tracking-[.06em] text-[var(--lp-accent)]">{o.label}</p>
                    <h3 className="mb-2 text-xl font-bold">{o.title}</h3>
                    <p className="m-0 text-base leading-relaxed text-slate-700">{o.text}</p>
                  </div>
                ))}
              </div>
              {page.options.soon && (
                <div className="mx-auto mt-10 max-w-[760px] rounded-2xl border-2 border-dashed border-slate-300 bg-white p-5 sm:p-6">
                  <p className="mb-1.5 text-sm font-bold uppercase tracking-[.06em] text-amber-700">{page.options.soon.label}</p>
                  <p className="m-0 text-base leading-relaxed text-slate-700">{page.options.soon.text}</p>
                  {page.options.soon.images.length > 0 && (
                    <div className={s.spread}>
                      {page.options.soon.images.map((im) => (
                        <div key={im.src} className={`${s.polaroid} ${s.printPage}`}>
                          {im.sample && <span className={s.sample}>SAMPLE</span>}
                          {/* Opens the full page so the small print is readable. */}
                          <a href={im.src} target="_blank" rel="noopener noreferrer"><img src={im.src} alt={im.alt} loading="lazy" /></a>
                          {im.note && <span className={hand}>{im.note}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {page.options.footnote && <p className="mt-5 text-center text-base text-slate-700">{page.options.footnote}</p>}
              <div className="mt-6 flex justify-center"><a href="#get-started" className={btn}>{page.options.cta || 'Book my free call'}</a></div>
            </div>
          </section>
        )}

        {page.story && (
          <section aria-labelledby="story-h" className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-8 px-5 py-14">
            {page.story.image && <img src={page.story.image.src} alt={page.story.image.alt} loading="lazy" className="aspect-[4/3] min-w-0 flex-[1_1_320px] rounded-[20px] object-cover" />}
            <div className="min-w-0 flex-[1_1_420px]">
              <h2 id="story-h" className={`mb-3.5 ${h2}`}>{page.story.title}</h2>
              {page.story.paragraphs.map((p) => <p key={p} className={`mb-3 ${body}`}>{p}</p>)}
            </div>
          </section>
        )}

        {sponsorshipsOpen && (
          <section aria-labelledby="spon-h" className="mx-auto max-w-[1120px] px-5 pb-14">
            <div className="flex flex-wrap items-center gap-5 rounded-[20px] border border-amber-300 bg-[#fff7e6] p-7">
              <div className="min-w-0 flex-[1_1_420px]">
                <h2 id="spon-h" className="mb-2 text-2xl font-extrabold">{page.sponsorship!.title}</h2>
                <p className="m-0 text-[17px] leading-relaxed text-amber-950">{page.sponsorship!.text}</p>
              </div>
              <a href="#get-started" className={`${btn} flex-none`}>{page.sponsorship!.cta}</a>
            </div>
          </section>
        )}

        <section aria-labelledby="how-h" className="border-t border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-[1120px] px-5 py-14">
            <h2 id="how-h" className={`mb-6 text-center ${h2}`}>How it works</h2>
            <ol className="m-0 flex list-none flex-wrap gap-5 p-0">
              {page.steps.map((st, i) => (
                <li key={st.title} className="flex min-w-0 flex-[1_1_260px] gap-3.5">
                  <span aria-hidden className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[var(--lp-accent)] font-extrabold text-white">{i + 1}</span>
                  <div>
                    <h3 className="m-0 mb-1 text-lg font-bold">{st.title}</h3>
                    <p className="m-0 text-base leading-relaxed text-slate-700">{st.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {page.gallery && (
          <section aria-labelledby="inside-h" className="overflow-hidden bg-[var(--lp-deep)] text-white">
            <div className="mx-auto max-w-[1120px] pb-10 pt-14">
              <div className="px-5 text-center">
                <h2 id="inside-h" className="mb-2.5 text-[30px] font-extrabold leading-tight">{page.gallery.title}</h2>
                {page.gallery.text && <p className="mx-auto max-w-[52ch] text-lg leading-normal text-[var(--lp-deep-text)]">{page.gallery.text}</p>}
              </div>
              <div className={s.fan}>
                {page.gallery.images.slice(0, 4).map((im) => (
                  <div key={im.src} className={s.phone}><img src={im.src} alt={im.alt} loading="lazy" /></div>
                ))}
              </div>
              {page.gallery.caption && <p className="mt-8 px-5 text-center text-sm text-[var(--lp-deep-text)]">{page.gallery.caption}</p>}
              <div className="mt-5 flex justify-center px-5"><a href="#get-started" className={btnLight}>Book my free call</a></div>
            </div>
          </section>
        )}

        {page.testimonials.length > 0 && (
          <section aria-labelledby="proof-h" className="mx-auto max-w-[760px] px-5 pt-14">
            <h2 id="proof-h" className="mb-3.5 text-2xl font-extrabold">What people say</h2>
            <div className="flex flex-col gap-4">
              {page.testimonials.map((t) => (
                <figure key={t.name} className="m-0 rounded-2xl border border-slate-200 p-5">
                  <blockquote className="m-0 text-lg leading-relaxed text-slate-800">&ldquo;{t.quote}&rdquo;</blockquote>
                  <figcaption className="mt-3 flex items-center gap-3 text-[15px] text-slate-600">
                    {t.photo && <img src={t.photo} alt="" className="h-10 w-10 rounded-full object-cover" />}
                    <span><strong className="text-slate-900">{t.name}</strong>{t.role ? `, ${t.role}` : ''}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}

        {page.faqs.length > 0 && (
          <section aria-labelledby="faq-h" className="mx-auto max-w-[760px] px-5 py-14">
            <h2 id="faq-h" className={`mb-[18px] ${h2}`}>Questions</h2>
            <div className="flex flex-col gap-2.5">
              {page.faqs.map((f) => (
                <details key={f.q} className="rounded-[14px] border border-slate-200 px-[18px] py-4">
                  <summary className="cursor-pointer text-[17px] font-bold">{f.q}</summary>
                  <p className="mb-0 mt-2.5 text-base leading-relaxed text-slate-700">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        <section aria-labelledby="end-h" className="bg-[var(--lp-deep)] text-white">
          <div className="mx-auto flex max-w-[760px] flex-col items-center gap-4 px-5 py-14 text-center">
            <h2 id="end-h" className="m-0 text-[32px] font-extrabold leading-tight">{page.closing.title}</h2>
            {page.closing.text && <p className="m-0 text-lg text-[var(--lp-deep-text)]">{page.closing.text}</p>}
            <a href="#get-started" className={btnLight}>{page.closing.cta}</a>
          </div>
        </section>

        {more.length > 0 && (
          <section aria-labelledby="more-h" className="mx-auto max-w-[1120px] px-5 py-10">
            <h2 id="more-h" className="mb-3 text-lg font-extrabold">More from {business}</h2>
            <ul className="m-0 flex list-none flex-col p-0">
              {more.map((m) => (
                <li key={m.href}><a href={m.href} className="inline-flex min-h-[44px] items-center gap-1.5 text-base font-semibold text-[var(--lp-accent)] hover:text-[var(--lp-accent-dark)]">{m.label}<ArrowRight className="h-4 w-4" aria-hidden /></a></li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <footer className="border-t border-slate-200 pb-24 sm:pb-0">
        <div className="mx-auto flex max-w-[1120px] flex-wrap justify-between gap-3 px-5 py-6 text-sm text-slate-600">
          <span>
            {label} is offered through NowTRANSFORMED, a youth leadership development program{page.partnerLine ? `, ${page.partnerLine}` : ''}.
            {signup.mailingAddress && <> {signup.mailingAddress}</>}
          </span>
          <span><a href="/privacy" className="text-[var(--lp-accent)] underline">Privacy</a> · <a href="/terms" className="text-[var(--lp-accent)] underline">Terms</a></span>
        </div>
      </footer>

      {/* Phones: the call button stays in reach while reading */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-300 bg-white px-4 pb-3.5 pt-2.5 shadow-[0_-6px_20px_rgba(15,23,42,.08)] sm:hidden">
        <a href="#get-started" className={`${btn} w-full`}>Book my free call</a>
      </div>
    </div>
  )
}
