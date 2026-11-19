import { NextResponse, type NextRequest } from 'next/server'
import { CALLBACK_PATH_HEADER } from '@/lib/safe-callback'

/**
 * Deep links from emails and push notifications (program pages) must survive sign-in (A16).
 * The pages themselves redirect to a bare /login when there is no session, which loses the link,
 * so for these paths only: no session cookie at all -> /login?callbackUrl=<the link>.
 *
 * Only cookie PRESENCE is checked (edge-safe, no secret, no DB). A present but stale cookie falls
 * through to the page's own check; for that case the link is passed on in the `x-callback-path` request
 * header, so the dashboard layout's sign-in redirect keeps it too. Every other path is untouched (see `config.matcher`).
 */
const SESSION_COOKIES = ['authjs.session-token', '__Secure-authjs.session-token']

function hasSessionCookie(req: NextRequest): boolean {
  // Large JWTs are split into chunks: "<name>.0", "<name>.1", ...
  return req.cookies.getAll().some((c) => SESSION_COOKIES.some((n) => c.name === n || c.name.startsWith(`${n}.`)))
}

export function middleware(req: NextRequest) {
  const here = req.nextUrl.pathname + req.nextUrl.search
  if (hasSessionCookie(req)) {
    const headers = new Headers(req.headers)
    headers.set(CALLBACK_PATH_HEADER, here)
    return NextResponse.next({ request: { headers } })
  }
  const login = new URL('/login', req.url)
  login.searchParams.set('callbackUrl', here)
  return NextResponse.redirect(login)
}

export const config = {
  matcher: [
    '/coach/programs/:path*', '/ambassador/programs/:path*', '/admin/program-pages/:path*',
    // Support message links in emails and push notifications.
    '/coach/support/:path*', '/ambassador/support/:path*', '/associate/support/:path*', '/admin/support/:path*', '/team/:path*',
  ],
}
