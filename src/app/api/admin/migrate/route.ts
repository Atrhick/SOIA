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
  {
    id: '2026_08_17_add_program_pages_and_associates',
    description:
      'Add coach program pages (public landing + qualification leads) and the associate roles',
    sql: [
      // --- Enums. CREATE TYPE has no IF NOT EXISTS, so swallow duplicates. ---
      `DO $$ BEGIN
        CREATE TYPE "ProgramStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
      `DO $$ BEGIN
        CREATE TYPE "ProgramLeadAssociation" AS ENUM ('UNCLASSIFIED', 'AMBASSADOR', 'COACH', 'SERVICE_PROVIDER', 'BUSINESS_AFFILIATE', 'VOLUNTEER');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
      `DO $$ BEGIN
        CREATE TYPE "AssociateType" AS ENUM ('SERVICE_PROVIDER', 'BUSINESS_AFFILIATE', 'VOLUNTEER');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
      `DO $$ BEGIN
        CREATE TYPE "AssociateStatus" AS ENUM ('ACTIVE', 'INACTIVE');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

      // --- New UserRole values. Each is its own statement: Postgres will not
      // let a newly added enum value be used in the same transaction. ---
      `ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SUB_ADMIN'`,
      `ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SERVICE_PROVIDER'`,
      `ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'BUSINESS_AFFILIATE'`,
      `ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'VOLUNTEER'`,

      // --- coach_programs ---
      `CREATE TABLE IF NOT EXISTS "coach_programs" (
        "id" TEXT NOT NULL,
        "slug" TEXT NOT NULL,
        "coachId" TEXT,
        "assignedAt" TIMESTAMP(3),
        "assignedBy" TEXT,
        "name" TEXT NOT NULL,
        "organization" TEXT NOT NULL,
        "targetMarket" TEXT NOT NULL,
        "internshipOffering" TEXT NOT NULL,
        "servicesDescription" TEXT NOT NULL,
        "weeklyEngagement1" TEXT NOT NULL,
        "weeklyEngagement2" TEXT NOT NULL,
        "monthlyGrowthGoal" TEXT NOT NULL,
        "monthlyImpactGoal" TEXT NOT NULL,
        "headline" TEXT,
        "coachBio" TEXT,
        "programDescription" TEXT,
        "eventDatesText" TEXT,
        "zoomUrl" TEXT,
        "zoomInstructions" TEXT,
        "extraQuestions" JSONB NOT NULL DEFAULT '[]',
        "qualificationIntro" TEXT,
        "status" "ProgramStatus" NOT NULL DEFAULT 'DRAFT',
        "publishedSnapshot" JSONB,
        "submittedAt" TIMESTAMP(3),
        "reviewedAt" TIMESTAMP(3),
        "reviewedBy" TEXT,
        "reviewNotes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "coach_programs_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "coach_programs_slug_key" ON "coach_programs"("slug")`,
      `CREATE INDEX IF NOT EXISTS "coach_programs_coachId_idx" ON "coach_programs"("coachId")`,
      `CREATE INDEX IF NOT EXISTS "coach_programs_status_idx" ON "coach_programs"("status")`,
      `DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'coach_programs_coachId_fkey'
        ) THEN
          ALTER TABLE "coach_programs"
          ADD CONSTRAINT "coach_programs_coachId_fkey"
          FOREIGN KEY ("coachId") REFERENCES "coach_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END $$`,

      // --- program_leads ---
      `CREATE TABLE IF NOT EXISTS "program_leads" (
        "id" TEXT NOT NULL,
        "programId" TEXT NOT NULL,
        "fullName" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "profession" TEXT NOT NULL,
        "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "token" TEXT NOT NULL,
        "answers" JSONB,
        "qualifiedAt" TIMESTAMP(3),
        "association" "ProgramLeadAssociation" NOT NULL DEFAULT 'UNCLASSIFIED',
        "classifiedAt" TIMESTAMP(3),
        "coachNotes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "program_leads_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "program_leads_token_key" ON "program_leads"("token")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "program_leads_programId_email_key" ON "program_leads"("programId", "email")`,
      `CREATE INDEX IF NOT EXISTS "program_leads_programId_association_idx" ON "program_leads"("programId", "association")`,
      `DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'program_leads_programId_fkey'
        ) THEN
          ALTER TABLE "program_leads"
          ADD CONSTRAINT "program_leads_programId_fkey"
          FOREIGN KEY ("programId") REFERENCES "coach_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$`,

      // --- associate_profiles ---
      `CREATE TABLE IF NOT EXISTS "associate_profiles" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "type" "AssociateType" NOT NULL,
        "status" "AssociateStatus" NOT NULL DEFAULT 'ACTIVE',
        "firstName" TEXT NOT NULL,
        "lastName" TEXT NOT NULL,
        "phone" TEXT,
        "organization" TEXT,
        "serviceOffered" TEXT,
        "notes" TEXT,
        "coachId" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "associate_profiles_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "associate_profiles_userId_key" ON "associate_profiles"("userId")`,
      `CREATE INDEX IF NOT EXISTS "associate_profiles_type_status_idx" ON "associate_profiles"("type", "status")`,
      `DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'associate_profiles_userId_fkey'
        ) THEN
          ALTER TABLE "associate_profiles"
          ADD CONSTRAINT "associate_profiles_userId_fkey"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$`,
      `DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'associate_profiles_coachId_fkey'
        ) THEN
          ALTER TABLE "associate_profiles"
          ADD CONSTRAINT "associate_profiles_coachId_fkey"
          FOREIGN KEY ("coachId") REFERENCES "coach_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END $$`,
    ],
  },
  {
    id: '2026_08_18_program_title_and_second_meeting_link',
    description: 'Add page title and a second meeting link to coach programs',
    sql: [
      `ALTER TABLE "coach_programs" ADD COLUMN IF NOT EXISTS "pageTitle" TEXT`,
      `ALTER TABLE "coach_programs" ADD COLUMN IF NOT EXISTS "zoomLabel" TEXT`,
      `ALTER TABLE "coach_programs" ADD COLUMN IF NOT EXISTS "secondMeetingUrl" TEXT`,
      `ALTER TABLE "coach_programs" ADD COLUMN IF NOT EXISTS "secondMeetingLabel" TEXT`,
    ],
  },
  {
    id: '2026_08_19_time_clock_integrity',
    description:
      'Foreign keys, lookup indexes and a one-running-timer constraint for the time clock',
    sql: [
      // Orphan rows would block the foreign keys below. Both tables were
      // verified clean before this shipped; the deletes are a safety net for
      // any environment that is not.
      `DELETE FROM "time_clock_entries" e WHERE NOT EXISTS (SELECT 1 FROM "users" u WHERE u.id = e."userId")`,
      `DELETE FROM "time_entries" e WHERE NOT EXISTS (SELECT 1 FROM "users" u WHERE u.id = e."userId")`,
      `CREATE INDEX IF NOT EXISTS "time_clock_entries_userId_timestamp_idx" ON "time_clock_entries" ("userId", "timestamp")`,
      `CREATE INDEX IF NOT EXISTS "time_entries_userId_startTime_idx" ON "time_entries" ("userId", "startTime")`,
      // Close any duplicate running timers before the constraint is applied,
      // keeping the newest one.
      `UPDATE "time_entries" t SET "endTime" = now(), "duration" = GREATEST(0, EXTRACT(EPOCH FROM (now() - t."startTime"))/60)::int
         WHERE t."endTime" IS NULL
           AND EXISTS (SELECT 1 FROM "time_entries" o WHERE o."userId" = t."userId" AND o."endTime" IS NULL AND o."startTime" > t."startTime")`,
      // Prisma cannot express a partial index, so the "at most one running
      // timer per user" rule is enforced here. startTimer catches P2002.
      `CREATE UNIQUE INDEX IF NOT EXISTS "time_entries_one_running_per_user" ON "time_entries" ("userId") WHERE "endTime" IS NULL`,
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
