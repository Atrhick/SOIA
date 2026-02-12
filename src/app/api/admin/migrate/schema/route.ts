import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { exec } from 'child_process'
import path from 'path'

const MIGRATION_SECRET = process.env.MIGRATION_SECRET

function extractSecret(request: NextRequest): string {
  const authHeader =
    request.headers.get('Authorization') ||
    request.headers.get('x-migration-secret') ||
    ''
  return authHeader.replace('Bearer ', '')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isAuthorized(session: any, secretKey: string) {
  return (
    (session?.user?.role === 'ADMIN' && !session.user.isImpersonating) ||
    (MIGRATION_SECRET && secretKey === MIGRATION_SECRET)
  )
}

export async function GET(request: NextRequest) {
  const session = await auth()
  const secretKey = extractSecret(request)

  if (!isAuthorized(session, secretKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()

  try {
    const prismaPath = path.join(process.cwd(), 'node_modules', 'prisma', 'build', 'index.js')
    const output = await runCommand(`node "${prismaPath}" db push --skip-generate 2>&1`, 120000)

    return NextResponse.json({
      status: 'checked',
      output: output.trim(),
      durationMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    })
  } catch (error: unknown) {
    const err = error as { stdout?: string; stderr?: string; message?: string }
    return NextResponse.json(
      {
        status: 'error',
        output: (err.stdout || '') + '\n' + (err.stderr || ''),
        error: err.message || 'Unknown error',
        durationMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const session = await auth()
  const secretKey = extractSecret(request)

  if (!isAuthorized(session, secretKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if --accept-data-loss flag is requested
  let acceptDataLoss = false
  try {
    const body = await request.json()
    acceptDataLoss = body?.acceptDataLoss === true
  } catch {
    // No body or invalid JSON — default to false
  }

  const startTime = Date.now()

  try {
    const prismaPath = path.join(process.cwd(), 'node_modules', 'prisma', 'build', 'index.js')
    const flags = acceptDataLoss ? '--skip-generate --accept-data-loss' : '--skip-generate'
    const output = await runCommand(`node "${prismaPath}" db push ${flags} 2>&1`, 120000)

    return NextResponse.json({
      status: 'completed',
      output: output.trim(),
      durationMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    })
  } catch (error: unknown) {
    const err = error as { stdout?: string; stderr?: string; message?: string }
    return NextResponse.json(
      {
        status: 'failed',
        output: ((err.stdout || '') + '\n' + (err.stderr || '')).trim(),
        error: err.message || 'Unknown error',
        durationMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

function runCommand(command: string, timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(
      command,
      {
        timeout,
        cwd: process.cwd(),
        env: { ...process.env },
        maxBuffer: 1024 * 1024 * 5, // 5MB buffer
      },
      (error, stdout, stderr) => {
        if (error) {
          const enriched = Object.assign(error, { stdout, stderr })
          reject(enriched)
        } else {
          resolve(stdout + (stderr ? '\n' + stderr : ''))
        }
      }
    )
  })
}
