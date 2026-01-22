'use server'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'

// Secret key for migration access (set in environment variables)
const MIGRATION_SECRET = process.env.MIGRATION_SECRET

// Define pending migrations here
const MIGRATIONS = [
  {
    id: '2026_01_21_add_orientation_token',
    description: 'Add orientationToken to prospects table',
    sql: `
      ALTER TABLE "prospects" ADD COLUMN IF NOT EXISTS "orientationToken" TEXT;
      CREATE UNIQUE INDEX IF NOT EXISTS "prospects_orientationToken_key" ON "prospects"("orientationToken");
    `,
  },
  {
    id: '2026_01_21_add_event_booking',
    description: 'Add eventId to calendar_bookings table',
    sql: `
      ALTER TABLE "calendar_bookings" ADD COLUMN IF NOT EXISTS "eventId" TEXT;
    `,
  },
  {
    id: '2026_01_21_add_event_booking_fk',
    description: 'Add foreign key for eventId in calendar_bookings',
    sql: `
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'calendar_bookings_eventId_fkey'
        ) THEN
          ALTER TABLE "calendar_bookings"
          ADD CONSTRAINT "calendar_bookings_eventId_fkey"
          FOREIGN KEY ("eventId") REFERENCES "calendar_events"("id")
          ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END $$;
    `,
  },
]

// Create migrations tracking table if it doesn't exist
async function ensureMigrationsTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "_custom_migrations" (
      "id" TEXT PRIMARY KEY,
      "applied_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `)
}

// Get applied migrations
async function getAppliedMigrations(): Promise<string[]> {
  try {
    const result = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "_custom_migrations"`
    )
    return result.map((r) => r.id)
  } catch {
    return []
  }
}

// Mark migration as applied
async function markMigrationApplied(id: string) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "_custom_migrations" (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`,
    id
  )
}

export async function GET(request: NextRequest) {
  // Check authentication - either admin session or secret key
  const session = await auth()
  const secretKey = request.nextUrl.searchParams.get('secret')

  const isAuthorized =
    (session?.user?.role === 'ADMIN') ||
    (MIGRATION_SECRET && secretKey === MIGRATION_SECRET)

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await ensureMigrationsTable()
    const appliedMigrations = await getAppliedMigrations()

    const pendingMigrations = MIGRATIONS.filter(m => !appliedMigrations.includes(m.id))

    return NextResponse.json({
      status: 'ok',
      applied: appliedMigrations,
      pending: pendingMigrations.map(m => ({ id: m.id, description: m.description })),
      total: MIGRATIONS.length,
    })
  } catch (error) {
    console.error('Migration status error:', error)
    return NextResponse.json({ error: 'Failed to check migration status' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  // Check authentication - either admin session or secret key
  const session = await auth()
  const secretKey = request.nextUrl.searchParams.get('secret')

  const isAuthorized =
    (session?.user?.role === 'ADMIN') ||
    (MIGRATION_SECRET && secretKey === MIGRATION_SECRET)

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: { id: string; status: string; error?: string }[] = []

  try {
    await ensureMigrationsTable()
    const appliedMigrations = await getAppliedMigrations()

    for (const migration of MIGRATIONS) {
      if (appliedMigrations.includes(migration.id)) {
        results.push({ id: migration.id, status: 'already_applied' })
        continue
      }

      try {
        await prisma.$executeRawUnsafe(migration.sql)
        await markMigrationApplied(migration.id)
        results.push({ id: migration.id, status: 'success' })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        results.push({ id: migration.id, status: 'failed', error: errorMessage })
        // Continue with other migrations even if one fails
      }
    }

    return NextResponse.json({
      status: 'completed',
      results,
      summary: {
        total: MIGRATIONS.length,
        applied: results.filter(r => r.status === 'success').length,
        skipped: results.filter(r => r.status === 'already_applied').length,
        failed: results.filter(r => r.status === 'failed').length,
      },
    })
  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json({ error: 'Migration failed' }, { status: 500 })
  }
}
