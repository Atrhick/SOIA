'use client'

/**
 * Computer-width preview: the full-size preview route (/page-preview/[id]) in an iframe 1280px wide,
 * scaled down to fit its column, so a ~700px column shows the real desktop layout and not the phone one.
 * The frame is same-site, so its content height is measured (and re-measured as images load) to size the box.
 * Out of the tab order: the preview is look-only (its content is inert) and "See it full size" is the way in.
 */
import { useEffect, useRef, useState } from 'react'

const FRAME_WIDTH = 1280

export function ScaledPreviewFrame({ src, title, maxHeight }: { src: string; title: string; maxHeight?: number }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [scale, setScale] = useState(0.5)
  const [height, setHeight] = useState(900)

  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const ro = new ResizeObserver(() => { if (box.clientWidth > 0) setScale(box.clientWidth / FRAME_WIDTH) })
    ro.observe(box)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    let ro: ResizeObserver | null = null
    const measure = () => {
      const doc = frame.contentDocument
      if (!doc?.body) return
      const h = doc.body.scrollHeight
      if (h > 0) setHeight(h)
      if (!ro) {
        ro = new ResizeObserver(() => { const n = doc.body.scrollHeight; if (n > 0) setHeight(n) })
        ro.observe(doc.body)
      }
    }
    frame.addEventListener('load', measure)
    measure()
    return () => { frame.removeEventListener('load', measure); ro?.disconnect() }
  }, [src])

  const shown = height * scale
  return (
    <div
      ref={boxRef}
      className={`relative w-full bg-white ${maxHeight ? 'overflow-y-auto overflow-x-hidden' : 'overflow-hidden'}`}
      style={maxHeight ? { maxHeight } : undefined}
    >
      <div style={{ height: shown }}>
        <iframe
          ref={frameRef}
          src={src}
          title={title}
          tabIndex={-1}
          loading="lazy"
          scrolling="no"
          className="block origin-top-left border-0"
          style={{ width: FRAME_WIDTH, height, transform: `scale(${scale})` }}
        />
      </div>
    </div>
  )
}
