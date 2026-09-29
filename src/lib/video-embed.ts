// Turns a pasted video page link into an embeddable player URL.
// Plain module (no 'use server') so the public pages, the coach editor and the
// server-side validation all agree on what counts as a usable video link.

/**
 * Returns the player URL for a YouTube, Vimeo or Loom link, or null when the
 * link is not one of those. Only these hosts are embedded: an arbitrary URL in
 * an iframe on a public page would let any site be framed under our domain.
 */
export function toVideoEmbedUrl(raw: string | null | undefined): string | null {
  if (!raw) return null
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '')

  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0]
    return isYouTubeId(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null
  }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const fromQuery = url.searchParams.get('v')
    const fromPath = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/)?.[1]
    const id = fromQuery ?? fromPath
    return id && isYouTubeId(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    // vimeo.com/123, vimeo.com/123/abcdef (unlisted hash), player.vimeo.com/video/123
    const m = url.pathname.match(/^\/(?:video\/)?(\d+)(?:\/([a-f0-9]+))?/)
    if (!m) return null
    const hash = m[2] ?? url.searchParams.get('h')
    return `https://player.vimeo.com/video/${m[1]}${hash ? `?h=${hash}` : ''}`
  }
  if (host === 'loom.com') {
    const id = url.pathname.match(/^\/(?:share|embed)\/([a-zA-Z0-9]+)/)?.[1]
    return id ? `https://www.loom.com/embed/${id}` : null
  }
  return null
}

function isYouTubeId(id: string | undefined): id is string {
  return Boolean(id && /^[A-Za-z0-9_-]{11}$/.test(id))
}

export const VIDEO_LINK_HINT = 'Paste a YouTube, Vimeo or Loom link.'
