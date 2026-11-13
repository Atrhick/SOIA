import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/** The version this server is running (see next.config.js). Public: it's only a build timestamp. */
export function GET() {
  return NextResponse.json(
    { version: process.env.NEXT_PUBLIC_APP_VERSION ?? '' },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
