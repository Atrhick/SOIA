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
    sql: [
      `ALTER TABLE "prospects" ADD COLUMN IF NOT EXISTS "orientationToken" TEXT`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "prospects_orientationToken_key" ON "prospects"("orientationToken")`,
    ],
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
  {
    id: '2026_01_21_delete_orientation_recurring_slots',
    description: 'Delete recurring slots from orientation calendar (use events instead)',
    sql: `
      DELETE FROM "calendar_slots"
      WHERE "calendarId" IN (
        SELECT id FROM "admin_calendars" WHERE "publicSlug" = 'orientation'
      );
    `,
  },
  {
    id: '2026_02_12_add_performance_indexes',
    description: 'Add database indexes for query performance optimization',
    sql: [
      `CREATE INDEX IF NOT EXISTS "calendar_bookings_prospectId_idx" ON "calendar_bookings"("prospectId")`,
      `CREATE INDEX IF NOT EXISTS "calendar_bookings_calendarId_idx" ON "calendar_bookings"("calendarId")`,
      `CREATE INDEX IF NOT EXISTS "calendar_bookings_status_idx" ON "calendar_bookings"("status")`,
      `CREATE INDEX IF NOT EXISTS "channel_posts_channelId_createdAt_idx" ON "channel_posts"("channelId", "createdAt")`,
      `CREATE INDEX IF NOT EXISTS "lms_enrollments_status_idx" ON "lms_enrollments"("status")`,
      `CREATE INDEX IF NOT EXISTS "lms_enrollments_lastAccessedAt_idx" ON "lms_enrollments"("lastAccessedAt")`,
    ],
  },
  {
    id: '2026_03_02_add_password_reset_tokens',
    description: 'Add password_reset_tokens table for secure password reset flow',
    sql: [
      `CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "token" TEXT NOT NULL,
        "expiresAt" TIMESTAMP(3) NOT NULL,
        "usedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_tokens_token_key" ON "password_reset_tokens"("token")`,
      `CREATE INDEX IF NOT EXISTS "password_reset_tokens_token_idx" ON "password_reset_tokens"("token")`,
      `CREATE INDEX IF NOT EXISTS "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId")`,
      `DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'password_reset_tokens_userId_fkey'
        ) THEN
          ALTER TABLE "password_reset_tokens"
          ADD CONSTRAINT "password_reset_tokens_userId_fkey"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$`,
      // Add prospect and calendar booking indexes from schema audit
      `CREATE INDEX IF NOT EXISTS "prospects_assessmentSurveyId_idx" ON "prospects"("assessmentSurveyId")`,
      `CREATE INDEX IF NOT EXISTS "calendar_bookings_userId_idx" ON "calendar_bookings"("userId")`,
    ],
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
  // Check authentication - either admin session or secret key via Authorization header
  const session = await auth()
  const authHeader = request.headers.get('Authorization') || request.headers.get('x-migration-secret') || ''
  const secretKey = authHeader.replace('Bearer ', '')

  const isAuthorized =
    (session?.user?.role === 'ADMIN' && !session.user.isImpersonating) ||
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
  // Check authentication - either admin session or secret key via Authorization header
  const session = await auth()
  const authHeader = request.headers.get('Authorization') || request.headers.get('x-migration-secret') || ''
  const secretKey = authHeader.replace('Bearer ', '')

  const isAuthorized =
    (session?.user?.role === 'ADMIN' && !session.user.isImpersonating) ||
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
        const statements = Array.isArray(migration.sql) ? migration.sql : [migration.sql]
        for (const stmt of statements) {
          await prisma.$executeRawUnsafe(stmt)
        }
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
