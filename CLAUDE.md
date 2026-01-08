# CLAUDE.md - AI Assistant Context

This file provides context for AI assistants working on the StageOneInAction Back Office codebase.

## Project Overview

This is a **Next.js 14** web application for managing coaches and ambassadors in the StageOneInAction organization. It's a comprehensive back-office platform with role-based access for Admins, Coaches, and Ambassadors.

### Key Features
- **Admin Impersonation**: Admins can view the app as any coach or ambassador via the profile dropdown menu (with visual banner indicator)
- **Ambassador Profile Editing**: Ambassadors can edit their profile with photo URL, bio, and social media links
- **Ambassador Account Creation**: Admins/Coaches can create ambassador accounts (ages 10-24) with enhanced form inputs
- **Parental Consent Flow**: Ambassadors under 18 require parent/guardian info; parent account auto-created with PARENT role
- **Enhanced Form Components**: Phone input with country selector, password generator with strength meter, structured address fields, date of birth dropdowns
- **Admin-Configurable Business Tools**: 6 feature modules (CRM, Project Management, Collaboration, Time Clock, Scheduling, Knowledge Base) with per-role and per-user access control
- **User Management**: Admins can create user accounts and configure per-user feature permissions (grant/deny access)

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

Session includes: `id`, `email`, `role`, `coachId` (for coaches), `ambassadorId` (for ambassadors), `isImpersonating`, and `originalAdminId` (when admin is impersonating)

## Database Schema Notes

### Key Models

- `User` - Authentication (has role: ADMIN, COACH, AMBASSADOR, or PARENT)
- `CoachProfile` - Extended coach data (linked 1:1 with User)
- `Ambassador` - Youth managed by coaches (ages 10-24, has profile fields, address, parent/guardian info)
- `Course` / `QuizQuestion` / `QuizOption` - Training system
- `WeeklyGoal` / `IncomeEntry` - Goal and income tracking
- `SponsorshipRequest` - Funding requests
- `Event` / `EventRSVP` - Event management
- `MessageThread` / `Message` - Messaging system
- `ResourceCenter` / `ResourceCenterApplication` - Resource centers
- `BusinessExcellenceCRM` / `WebsiteContentStatus` / `OutreachActivityTarget` - Business tools

### Business Tools Models

- `FeatureConfig` - Feature toggles per role (isEnabled, enabledForCoaches, enabledForAmbassadors)
- `UserFeaturePermission` - Per-user feature overrides with granted boolean
- `CRMPipelineStage` / `CRMContact` / `CRMDeal` / `CRMActivity` - CRM system
- `Project` / `Task` / `ProjectMilestone` - Project management
- `CollaborationChannel` / `ChannelPost` / `ChannelPostReply` / `ChannelMember` - Discussion channels
- `SharedDocument` - Document sharing with role-based access
- `TimeClockEntry` / `TimeEntry` - Time tracking (attendance + project-based)
- `CalendarEvent` / `EventAttendee` - Scheduling and calendar
- `KBCategory` / `KBArticle` - Knowledge base with publishing workflow

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
├── coach/           # Coach routes (/coach/*)
│   └── [feature]/
│       ├── page.tsx
│       └── [feature]-client.tsx
└── ambassador/      # Ambassador routes (/ambassador/*)
    └── [feature]/
        ├── page.tsx
        └── [feature]-form.tsx    # Client form components

src/lib/actions/     # Server actions
src/components/
├── providers.tsx    # SessionProvider wrapper (required for useSession)
├── dashboard/       # Header with impersonation, Sidebar
└── ui/              # Reusable UI components (dropdown-menu, dialog, etc.)
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
- **Ambassador:** ambassador@stageoneinaction.com / ambassador123

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

## UI Design Patterns

### Authentication Pages

The login and forgot-password pages use a modern design with animations:

**Layout (`src/app/(auth)/layout.tsx`):**
- Dark gradient background (primary-900 to primary-950)
- Animated floating orbs with `animate-pulse-glow`
- Decorative geometric shapes with `animate-float` and `animate-float-delayed`
- Subtle grid pattern overlay

**Card Style:**
- Glassmorphism effect using the `.glass` CSS class
- Rounded 3xl corners with shadow
- Staggered slide-up animations for content

**Form Inputs:**
- Custom styled inputs (not using the Input component)
- Icon prefixes (Mail, Lock icons from Lucide)
- Focus states with color transitions and ring effects
- Show/hide password toggle

**Buttons:**
- Gradient backgrounds with shadow glow
- Shimmer effect on hover
- Scale transform on hover
- Arrow icon animation

**Animation Classes (defined in `globals.css`):**
- `animate-float` / `animate-float-delayed` - Floating motion
- `animate-pulse-glow` - Pulsating glow effect
- `animate-gradient` - Shifting gradient background
- `animate-slide-up` - Slide up entrance
- `animate-fade-in` / `animate-scale-in` - Fade/scale entrance
- `animation-delay-100` through `animation-delay-500` - Staggered delays
- `.glass` - Glassmorphism with backdrop blur

## Admin Impersonation

Admins can view the app as any coach or ambassador:

1. Click profile dropdown in header
2. Select "Login as User" → choose a coach or ambassador
3. Session is updated via `useSession().update()` with impersonation data
4. An amber banner appears in the header showing "Viewing as: [email] ([role])"
5. To switch back, click "Switch Back" button in banner or profile dropdown → "Switch Back to Admin"

**Key files:**
- `src/lib/actions/impersonation.ts` - Server actions for impersonation
- `src/components/dashboard/header.tsx` - Dropdown menu with impersonation UI
- `src/lib/auth.ts` - JWT callback handles session updates for impersonation

**Session fields when impersonating:**
- `isImpersonating: true`
- `originalAdminId: string` - The admin's real user ID
- `id`, `role`, `coachId`, `ambassadorId` - Set to the impersonated user's values

## Ambassador Profile Fields

The Ambassador model includes these profile fields:
- `photoUrl` - Profile photo URL
- `bio` - Bio text
- `instagramUrl`, `facebookUrl`, `twitterUrl`, `tiktokUrl`, `linkedinUrl`, `youtubeUrl`, `websiteUrl` - Social media links
- `address1`, `address2`, `city`, `state`, `postalCode`, `country` - Address fields
- `phone`, `phoneCountryCode` - Phone with country code
- `parentFirstName`, `parentLastName`, `parentEmail`, `parentPhone`, `parentRelationship` - Parent/guardian info (for under 18)
- `parentUserId` - Links to parent's User account

Updated via `updateAmbassadorProfile()` action in `src/lib/actions/ambassador-auth.ts`

## Enhanced Form Components

Reusable form components in `src/components/ui/`:

### PhoneInput (`phone-input.tsx`)
- Country selector dropdown with flags and dial codes (47 countries)
- Auto-formatting based on country-specific phone masks
- Returns: phone number, country code, and full formatted number

### PasswordInput (`password-input.tsx`)
- Show/hide password toggle
- Auto-generate secure password button
- Password strength meter (Weak/Fair/Good/Strong with color indicators)
- Requirements checklist (length, uppercase, lowercase, number, special char)

### DateOfBirthInput (`date-of-birth-input.tsx`)
- Separate Month/Day/Year dropdown selectors (no native date picker)
- Automatic age calculation and display
- Configurable min/max age validation (default: 10-24 for ambassadors)

### AddressInput (`address-input.tsx`)
- Structured fields: Address Line 1, Address Line 2, City, State/Province, Postal/ZIP Code, Country
- Country dropdown (US, Canada, etc.)
- Dynamic state/province dropdown for US and Canada
- Labels adapt based on country (ZIP Code vs Postal Code, State vs Province)

## Email Field Standards

All email input fields should use the placeholder `name@example.com` for consistency.

## Parental Consent Flow

When creating an ambassador under 18:
1. The form automatically shows the "Parent/Guardian Information Required" section
2. Required fields: Parent first name, last name, email, relationship
3. A User account with role `PARENT` is auto-created for the parent
4. Parent can log in and monitor their child's ambassador account
5. Ambassador record links to parent via `parentUserId` field

## Admin-Configurable Business Tools

Six feature modules with role-based and per-user access control:

| Feature | Feature Key | Coach Default | Ambassador Default |
|---------|-------------|---------------|-------------------|
| CRM | `CRM` | Enabled | Disabled |
| Project Management | `PROJECT_MANAGEMENT` | Enabled | Disabled |
| Collaboration | `COLLABORATION` | Enabled | Enabled |
| Time Clock | `TIME_CLOCK` | Enabled | Enabled |
| Scheduling | `SCHEDULING` | Enabled | Enabled |
| Knowledge Base | `KNOWLEDGE_BASE` | Enabled | Enabled |

**Key files:**
- `src/lib/actions/feature-config.ts` - Feature check functions
- `src/lib/feature-names.ts` - Feature key constants (FEATURES object)
- `src/app/(dashboard)/admin/features/page.tsx` - Feature toggle dashboard

**Checking if a feature is enabled:**
```typescript
import { isFeatureEnabled } from '@/lib/actions/feature-config'

// In a page.tsx server component:
const featureEnabled = await isFeatureEnabled('COLLABORATION', 'COACH', session.user.id)
if (!featureEnabled) {
  return <FeatureDisabledMessage />
}
```

The `isFeatureEnabled` function checks:
1. Is the feature globally enabled?
2. Does the user have a specific override? (UserFeaturePermission)
3. Is it enabled for the user's role?

## User Management & Per-User Permissions

Admins can create users and set per-user feature permissions:

**Key files:**
- `src/lib/actions/users.ts` - User CRUD and permission functions
- `src/app/(dashboard)/admin/users/page.tsx` - User management UI
- `src/app/(dashboard)/admin/users/users-admin-client.tsx` - Client component

**Permission levels:**
- **Default** - Use role-based setting (no override)
- **Grant** - Always allow access regardless of role default
- **Deny** - Always block access regardless of role default

**Database model:**
```prisma
model UserFeaturePermission {
  id        String   @id @default(cuid())
  userId    String
  feature   String   // "CRM", "PROJECT_MANAGEMENT", etc.
  granted   Boolean  // true = grant, false = deny
  @@unique([userId, feature])
}
```

**Setting permissions:**
```typescript
import { setUserFeaturePermission } from '@/lib/actions/users'

// Grant specific feature
await setUserFeaturePermission(userId, 'CRM', true)

// Deny specific feature
await setUserFeaturePermission(userId, 'CRM', false)

// Remove override (use role default)
await setUserFeaturePermission(userId, 'CRM', null)
```

## Collaboration System

Team discussion channels and document sharing:

**Key files:**
- `src/lib/actions/collaboration.ts` - Channel and document actions
- `src/app/(dashboard)/admin/collaboration/` - Admin channel management
- `src/app/(dashboard)/coach/collaboration/` - Coach collaboration view
- `src/app/(dashboard)/ambassador/collaboration/` - Ambassador collaboration view

**Features:**
- Channels with role-based access (allowedRoles array)
- Posts and replies within channels
- Pin/unpin posts
- Shared documents with role-based visibility

## Knowledge Base

Articles and documentation for coaches and ambassadors:

**Key files:**
- `src/lib/actions/knowledge-base.ts` - Article and category actions
- `src/app/(dashboard)/admin/knowledge-base/` - Admin article management

**Article workflow:**
- DRAFT → PUBLISHED → ARCHIVED
- Categories with hierarchy (parentId)
- Role-based access (allowedRoles array)
- View count tracking
