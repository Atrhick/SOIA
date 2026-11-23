'use client'

/**
 * The page editor's live preview: the REAL landing page (OfferLanding) drawn from what is typed, at phone
 * width. It is rendered into an iframe (with this page's styles copied in) so the page's own phone layout
 * applies, as on a 390px phone, whatever the width of the screen around it; on narrower columns the frame is
 * scaled down to fit, like ScaledPreviewFrame does for the computer layout. Look-only: the sign-up form is
 * switched off (a disabled fieldset, as in OfferPreview) and nothing in the frame can be clicked.
 */
import { Component, useEffect, useRef, useState, type ReactNode } from 'react'
// @ts-expect-error -- the project has no @types/react-dom (react-dom itself ships with Next); typed below
import { createPortal as untypedCreatePortal } from 'react-dom'
import { OfferLanding } from '@/components/get-involved/offer-landing/offer-landing'
import type { SignupPageProps } from '@/components/get-involved/signup/signup-page'
import type { OfferPage } from '@/lib/get-involved/offer-page'

const PHONE_WIDTH = 390
const createPortal = untypedCreatePortal as (children: ReactNode, container: Element) => ReactNode

class PreviewBoundary extends Component<{ children: ReactNode; resetKey: string }, { failed: boolean; key: string }> {
  state = { failed: false, key: this.props.resetKey }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  static getDerivedStateFromProps(props: { resetKey: string }, state: { failed: boolean; key: string }) {
    return props.resetKey !== state.key ? { failed: false, key: props.resetKey } : null
  }
  render() {
    if (this.state.failed) return <p style={{ margin: 16, fontFamily: 'sans-serif' }}>The preview can&apos;t show this yet. Keep writing; it updates as you type.</p>
    return this.props.children
  }
}

/** Copies the app's stylesheets into the frame, and keeps them in step (new styles load as parts appear). */
function syncStyles(doc: Document) {
  doc.head.querySelectorAll('[data-copied-style]').forEach((n) => n.remove())
  document.head.querySelectorAll('link[rel="stylesheet"], style').forEach((n) => {
    const c = n.cloneNode(true) as HTMLElement
    c.setAttribute('data-copied-style', '')
    doc.head.appendChild(c)
  })
}

export function LivePreview({ page, signup, business, height = 780 }: { page: OfferPage; signup: SignupPageProps; business: string; height?: number }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [body, setBody] = useState<HTMLElement | null>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const ro = new ResizeObserver(() => { if (box.clientWidth > 0) setScale(Math.min(1, box.clientWidth / PHONE_WIDTH)) })
    ro.observe(box)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    let mo: MutationObserver | null = null
    const setup = () => {
      const doc = frame.contentDocument
      if (!doc?.body || doc.body.hasAttribute('data-ready')) return
      doc.documentElement.className = document.documentElement.className
      doc.documentElement.style.cssText = document.documentElement.style.cssText
      doc.body.className = document.body.className
      doc.body.setAttribute('data-ready', '')
      doc.body.style.margin = '0'
      doc.body.style.background = '#fff'
      const own = doc.createElement('style')
      own.textContent = 'a,button,input,select,textarea,label,summary{pointer-events:none!important}'
      doc.head.appendChild(own)
      syncStyles(doc)
      mo?.disconnect()
      mo = new MutationObserver(() => syncStyles(doc))
      mo.observe(document.head, { childList: true })
      setBody(doc.body)
    }
    frame.addEventListener('load', setup)
    if (frame.contentDocument?.readyState === 'complete') setup()
    return () => { frame.removeEventListener('load', setup); mo?.disconnect() }
  }, [])

  return (
    <div ref={boxRef} className="w-full">
      <div className="mx-auto overflow-hidden rounded-[22px] border-4 border-gray-800 bg-white shadow-md" style={{ width: PHONE_WIDTH * scale + 8, height: height * scale + 8 }}>
        <iframe
          ref={frameRef}
          title="Live preview of the page at phone width"
          tabIndex={-1}
          srcDoc='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body></body></html>'
          className="block origin-top-left border-0"
          style={{ width: PHONE_WIDTH, height, transform: `scale(${scale})` }}
        />
      </div>
      {body && createPortal(
        <PreviewBoundary resetKey={JSON.stringify(page)}>
          <div className="relative overflow-hidden bg-white" role="region" aria-label="Preview of the page">
            <fieldset disabled className="m-0 min-w-0 border-0 p-0" aria-label="Sign-up form (switched off in the preview)">
              <OfferLanding signup={{ ...signup, embedded: true }} page={page} business={business} more={[]} preview />
            </fieldset>
          </div>
        </PreviewBoundary>,
        body,
      )}
    </div>
  )
}
