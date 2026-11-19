/**
 * The page to open after sign-in, from a `?callbackUrl=` value. Pure and client-safe.
 * Only same-site relative paths are allowed ("/coach/programs/abc?x=1"); anything that could
 * leave the site ("https://...", "//host", "/\host", "javascript:") or loop back to sign-in
 * returns the fallback.
 */
export function safeCallbackPath(raw: string | null | undefined, fallback: string): string {
  if (!raw || raw.length > 2000) return fallback
  let v = raw.trim()
  // An absolute URL on this same site (NextAuth sometimes builds those) is reduced to its path.
  if (typeof window !== 'undefined' && v.startsWith(window.location.origin + '/')) v = v.slice(window.location.origin.length)
  if (!v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\')) return fallback
  // Control characters (tabs/newlines are stripped by URL parsers, turning "/\t/host" into "//host").
  if (/[\u0000-\u001f\u007f]/.test(v)) return fallback
  try {
    const u = new URL(v, 'http://same.invalid')
    if (u.origin !== 'http://same.invalid') return fallback
    // Dot segments can collapse into "//host" ("/.//evil.com" -> "//evil.com"), which a browser
    // reads as another site; a backslash is read as a slash by browsers.
    if (u.pathname.startsWith('//') || u.pathname.includes('\\') || /%5c/i.test(u.pathname)) return fallback
    if (u.pathname === '/login' || u.pathname === '/ambassador-login' || u.pathname.startsWith('/api/auth')) return fallback
    return u.pathname + u.search + u.hash
  } catch {
    return fallback
  }
}

/** The callbackUrl of the current page's address (browser only). */
export function callbackFromLocation(fallback: string): string {
  if (typeof window === 'undefined') return fallback
  return safeCallbackPath(new URLSearchParams(window.location.search).get('callbackUrl'), fallback)
}

/** The request header src/middleware.ts sets on deep-link paths: the path + query being opened. */
export const CALLBACK_PATH_HEADER = 'x-callback-path'

/** The sign-in page, coming back to `path` after (only a safe same-site path; else plain /login). */
export function loginPath(path: string | null | undefined): string {
  const back = safeCallbackPath(path, '')
  return back ? `/login?callbackUrl=${encodeURIComponent(back)}` : '/login'
}
