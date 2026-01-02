# CLAUDE.md - AI Assistant Context

This file provides context for AI assistants working on the StageOneInAction Back Office codebase.

## Project Overview

This is a **Next.js 14** web application for managing coaches and ambassadors in the StageOneInAction organization. It's a comprehensive back-office platform with role-based access for Admins and Coaches.

## Tech Stack

- **Framework:** Next.js 14 with App Router
- **Language:** TypeScript (strict mode)
- **Database:** PostgreSQL with Prisma ORM
- **Auth:** NextAuth.js v5 (beta) with credentials provider
- **Styling:** Tailwind CSS
- **Validation:** Zod schemas
- **Icons:** Lucide React

## Key Architectural Patterns

### Server Components vs Client Components

- **Server Components** (default): Used for data fetching pages. File: `page.tsx`
- **Client Components**: Used for interactivity. File: `*-client.tsx` with `'use client'` directive
- Pattern: Server component fetches data, serializes it, passes to client component

### Data Serialization

Prisma returns complex types that can't be passed directly to client components:
- `Date` objects → Convert to ISO strings: `date.toISOString()`
- `Decimal` objects → Convert to numbers: `decimal.toNumber()`
- Always serialize data in the server component before passing to client

### Server Actions

All data mutations use Next.js Server Actions in `src/lib/actions/`:
- Each action file handles a specific domain (ambassadors, events, etc.)
- Actions use `'use server'` directive
- Pattern: Validate with Zod → Check auth → Perform DB operation → `revalidatePath()`

### Authentication Flow

```typescript
const session = await auth()
if (!session || session.user.role !== 'COACH') {
  redirect('/login')
}
```

Session includes: `id`, `email`, `role`, and `coachId` (for coaches only)

## Database Schema Notes

### Key Models

- `User` - Authentication (has role: ADMIN or COACH)
- `CoachProfile` - Extended coach data (linked 1:1 with User)
- `Ambassador` - Youth managed by coaches
- `Course` / `QuizQuestion` / `QuizOption` - Training system
- `WeeklyGoal` / `IncomeEntry` - Goal and income tracking
- `SponsorshipRequest` - Funding requests
- `Event` / `EventRSVP` - Event management
- `MessageThread` / `Message` - Messaging system
- `ResourceCenter` / `ResourceCenterApplication` - Resource centers
- `BusinessExcellenceCRM` / `WebsiteContentStatus` / `OutreachActivityTarget` - Business tools

### Important Field Names

Be careful with these schema-specific names:
- Coach status: `coachStatus` (not `status`) - values: `ACTIVE_COACH`, `ONBOARDING_INCOMPLETE`
- Ambassador status: `status` - values: `PENDING`, `APPROVED`, `INACTIVE`, `COMPLETED`, `ON_HOLD`
- Resource center app field: `resourceCenterApp` (not `resourceCenterApplication`)
- RSVP status: `status` (not `response`) - values: `YES`, `NO`, `MAYBE`
- Sponsorship status: `SUBMITTED`, `UNDER_REVIEW`, `APPROVED_FULL`, `APPROVED_PARTIAL`, `PAYMENT_PLAN`, `NOT_APPROVED`
- Sponsorship amount: `amountRequested` (not `requestedAmount`)

## File Organization

```
src/app/(dashboard)/
├── admin/           # Admin routes (/admin/*)
│   └── [feature]/
│       ├── page.tsx              # Server component
│       └── [feature]-client.tsx  # Client component
└── coach/           # Coach routes (/coach/*)
    └── [feature]/
        ├── page.tsx
        └── [feature]-client.tsx

src/lib/actions/     # Server actions
src/components/ui/   # Reusable UI components
```

## Common Patterns

### Creating a New Feature

1. Add models to `prisma/schema.prisma` if needed
2. Run `npx prisma db push` to update database
3. Create server actions in `src/lib/actions/[feature].ts`
4. Create page at `src/app/(dashboard)/[role]/[feature]/page.tsx`
5. Create client component at `src/app/(dashboard)/[role]/[feature]/[feature]-client.tsx`
6. Add route to sidebar in `src/components/dashboard/sidebar.tsx`

### Form Handling

```typescript
// Client component
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  setIsSubmitting(true)

  const formData = new FormData()
  formData.set('field', value)

  const result = await serverAction(formData)
  if (result.error) {
    setError(result.error)
  } else {
    // Success handling
  }
  setIsSubmitting(false)
}
```

### Server Action Pattern

```typescript
'use server'

import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const schema = z.object({
  field: z.string().min(1),
})

export async function myAction(formData: FormData) {
  const session = await auth()
  if (!session || session.user.role !== 'COACH') {
    return { error: 'Unauthorized' }
  }

  const data = { field: formData.get('field') as string }
  const validated = schema.safeParse(data)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message }
  }

  try {
    await prisma.model.create({ data: validated.data })
    revalidatePath('/coach/feature')
    return { success: true }
  } catch (error) {
    console.error('Error:', error)
    return { error: 'Operation failed' }
  }
}
```

## Commands

```bash
npm run dev          # Start development server
npm run build        # Production build
npx prisma studio    # Database GUI
npx prisma db push   # Push schema changes
npx prisma db seed   # Seed demo data
```

## Demo Credentials

- **Admin:** admin@stageoneinaction.com / admin123
- **Coach:** coach@stageoneinaction.com / coach123

## Known Considerations

1. **Date handling:** Always serialize dates before passing to client components
2. **Decimal handling:** Use `.toNumber()` for Prisma Decimal fields
3. **Set iteration:** Use `Array.from(new Set(...))` not spread operator for Sets in strict mode
4. **User name:** The User model doesn't have a `name` field - use `email` or get name from CoachProfile

## Code Style

- Functional components with hooks
- Tailwind CSS for styling (no CSS modules)
- Lucide React for icons
- No emojis in code unless explicitly requested
- Prefer editing existing files over creating new ones
- Keep solutions simple - avoid over-engineering
