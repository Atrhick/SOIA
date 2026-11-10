# CLAUDE.md - AI Assistant Context

This file provides context for AI assistants working on the NowTransformed Back Office codebase.

## Project Overview

This is a **Next.js 14** web application for managing coaches and ambassadors in the NowTransformed organization. It's a comprehensive back-office platform with role-based access for Admins, Coaches, and Ambassadors.

### Key Features
- **Coach Prospect Pipeline**: Public assessment surveys for prospective coaches with automatic prospect tracking through the onboarding pipeline
- **Admin Impersonation**: Admins can view the app as any coach or ambassador via the profile dropdown menu (with visual banner indicator); auto-expires after 30 minutes
- **Password Reset Flow**: Secure token-based password reset (`/forgot-password` → email link → `/reset-password/[token]`); dev mode logs link to console
- **Login Rate Limiting**: 5 failed attempts per email → 15-minute lockout (in-memory, see `src/lib/auth.ts`)
- **Ambassador Profile Editing**: Ambassadors can edit their profile with photo URL, bio, and social media links
- **Ambassador Account Creation**: Admins/Coaches can create ambassador accounts (ages 10-24) with enhanced form inputs
- **Parental Consent Flow**: Ambassadors under 18 require parent/guardian info; parent account auto-created with PARENT role
- **Enhanced Form Components**: Phone input with country selector, password generator with strength meter, structured address fields, date of birth dropdowns
- **Admin-Configurable Business Tools**: 7 feature modules (CRM, Project Management, Collaboration, Time Clock, Scheduling, Knowledge Base, Program Pages) with per-role and per-user access control
- **User Management**: Admins can create user accounts and configure per-user feature permissions (grant/deny access)
- **Coach Program Pages**: Public landing page per program at `/p/[slug]` with a two-step signup — interest form, then a Zoom link plus a coach-customizable qualification form. Leads flow into the coach's Business Excellence area for classification. Admin-approved before publishing
- **Associate Roles**: SERVICE_PROVIDER, BUSINESS_AFFILIATE and VOLUNTEER logins sharing one `/associate` dashboard, managed at `/admin/associates`
- **Get Involved / One-A-Day** (phase 1, phase 2/3 foundation): coaches and ambassadors share `/join/[slug]` invite links, prospects book discovery calls with admin hosts; see the Get Involved section below


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

Session includes: `id`, `email`, `role`, `coachId` (for coaches), `ambassadorId` (for ambassadors), `isImpersonating`, `originalAdminId`, and `impersonatingAt` (when admin is impersonating)

**Rate limiting (in `src/lib/auth.ts`):**
- 5 failed login attempts per email triggers a 15-minute lockout
- Implemented as an in-memory `Map` — suitable for single-instance; switch to Redis for multi-instance
- Constants: `MAX_ATTEMPTS=5`, `WINDOW_MS=15min`, `LOCKOUT_MS=15min`

**Password reset (in `src/lib/actions/password-reset.ts`):**
- `requestPasswordReset(email)` — generates a 64-char hex token, stores in `password_reset_tokens`, sends email
- `validateResetToken(token)` — validates token exists, not used, not expired, user is ACTIVE
- `confirmPasswordReset(token, password)` — validates token + password, updates password + marks token used in a single `$transaction`
- Token expiry: 60 minutes; old unused tokens are invalidated on new request
- Password rules: min 8 chars, at least one uppercase, one lowercase, one number
- Email utility: `src/lib/email.ts` — logs to console in dev, needs provider connected for production

## Database Schema Notes

### Key Models

- `User` - Authentication (has role: ADMIN, COACH, AMBASSADOR, or PARENT)
- `CoachProfile` - Extended coach data (linked 1:1 with User)
- `Ambassador` - Youth managed by coaches (ages 10-24, has profile fields, address, parent/guardian info)
- `Course` / `QuizQuestion` / `QuizOption` - Legacy training system (being replaced by LMS)
- `LMSCourse` / `LMSModule` / `LMSLesson` / `LMSContentBlock` - New LMS system
- `LMSEnrollment` / `LMSLessonProgress` / `LMSContentProgress` - LMS progress tracking
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
- `PostReaction` - Emoji reactions on posts/replies (13 supported emojis)
- `PostMention` - @mention tracking with read status
- `PostAttachment` - File attachments linked to posts/replies
- `MeetingLink` - Meeting URLs (Zoom, Google Meet, Teams)
- `SharedDocument` - Document sharing with role-based access
- `TimeEntry` / `TimeEntryChange` - Time tracking: one row per timed stretch (running = no `endTime`), plus an edit history. Shared projects (`Project.isShared`) are admin-made and offered to coaches and ambassadors; only coaches can add personal ones. Admin view at `/admin/time`
- `CalendarEvent` / `EventAttendee` - Scheduling and calendar
- `KBCategory` / `KBArticle` - Knowledge base with publishing workflow

### Coach Prospect Pipeline Models

- `Prospect` - Prospective coach tracking through onboarding pipeline
- `ProspectStatusHistory` - Audit trail of status changes
- `ProspectPayment` - Payment tracking (Stripe, PayPal, Manual)
- `AdminNotification` - In-app notifications for admins

### Security Models

- `PasswordResetToken` - One-time password reset tokens (`token` TEXT UNIQUE, `expiresAt`, `usedAt` nullable). Table: `password_reset_tokens`. Cascade-deleted when `User` is deleted.

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
├── collaboration/   # Slack-like messaging components (EmojiPicker, ReactionBar, MentionInput, etc.)
├── dashboard/       # Header with impersonation, Sidebar
└── ui/              # Reusable UI components (dropdown-menu, dialog, checkbox, etc.)
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
npx prisma db push   # Push schema changes to DB
npm run db:generate  # Regenerate Prisma client after schema changes
npx prisma db seed   # Seed demo data
```

**Prisma CLI and DATABASE_URL:** the Prisma CLI reads `.env` only — `.env.local` is a
Next.js convention it does not know about. `DATABASE_URL` is therefore kept in **both**
files (identical values) so the commands above work as written. Both files are
gitignored. If you change the database, change it in both places.

**ESLint versions are pinned to match Next 14.** `eslint@^8.57.1` +
`eslint-config-next@^14.2.35`. Do not upgrade these independently: `next lint` in
Next 14 uses the ESLint 8 legacy API, and `eslint-config-next` 16 ships flat-config
only, so ESLint 9 + config 16 makes `next lint` — and therefore `next build` —
fail with `Invalid Options: Unknown options: useEslintrc, extensions`.

**`_custom_migrations`:** this table is created by raw SQL in
`src/app/api/admin/migrate/route.ts` and is declared in `schema.prisma` as the
`CustomMigration` model **only** so `prisma db push` does not treat it as drift and
drop it. Do not remove that model — without it, a push wipes the migration history
and every custom migration re-runs.

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
6. **Auto-expiry**: impersonation sessions are automatically reverted after 30 minutes; `impersonatingAt` timestamp in JWT is checked on every JWT callback

**Header Profile Name Display:**
The header displays the user's profile name (firstName + lastName) for coaches and ambassadors, fetched from `CoachProfile` or `Ambassador` model respectively. Falls back to email if name is not available. The dashboard layout (`src/app/(dashboard)/layout.tsx`) fetches the profile name and passes it to the Header component.

**Key files:**
- `src/lib/actions/impersonation.ts` - Server actions for impersonation
- `src/components/dashboard/header.tsx` - Dropdown menu with impersonation UI, displays profile name
- `src/lib/auth.ts` - JWT callback handles session updates, rate limiting, and impersonation timeout

**Session fields when impersonating:**
- `isImpersonating: true`
- `originalAdminId: string` - The admin's real user ID
- `impersonatingAt: number` - Unix timestamp when impersonation started (used for 30-min timeout check)
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
import { FeatureDisabled } from '@/components/ui/feature-disabled'

// In a page.tsx server component:
const featureEnabled = await isFeatureEnabled('COLLABORATION', 'COACH', session.user.id)
if (!featureEnabled) {
  return <FeatureDisabled title="Collaboration" icon={MessageSquare} />
}
```

Note: the 14 older gated pages each inline their own copy of this denial markup.
`FeatureDisabled` is the shared component; new gated pages should use it.

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

## Collaboration System (Slack-like Messaging)

Slack-like team communication with channels, DMs, @mentions, and reactions:

**Key files:**
- `src/lib/actions/collaboration.ts` - All collaboration server actions
- `src/components/collaboration/` - Reusable UI components
- `src/app/(dashboard)/*/collaboration/channels/` - Channel pages per role
- `src/app/(dashboard)/*/collaboration/messages/` - DM pages per role
- `src/app/(dashboard)/*/collaboration/files/` - File management (Coach/Admin only)

**Route Structure:**
```
src/app/(dashboard)/[role]/collaboration/
├── page.tsx                    # Redirects to /channels
├── channels/
│   ├── page.tsx                # Channels list (server)
│   └── channels-client.tsx     # Channels UI (client)
├── messages/
│   ├── page.tsx                # DM list (server)
│   └── messages-client.tsx     # DM UI (client)
└── files/
    ├── page.tsx                # Files list (server)
    └── files-client.tsx        # Files UI (client)
```

**UI Components (`src/components/collaboration/`):**
- `EmojiPicker` - Popover with 13 emoji reactions
- `ReactionBar` - Display grouped reactions with counts
- `MentionInput` - Textarea with @mention autocomplete dropdown
- `ThreadPanel` - Slide-out panel for threaded replies
- `AttachmentPicker` - Modal to select/upload documents
- `MeetingLinkCard` - Card for Zoom/Google Meet/Teams links
- `MessageBubble` - Styled message with author, reactions, replies

**@Mention Format:**
- Stored in content: `@[Display Name](user:userId)`
- Parse with: `/@\[([^\]]+)\]\(user:([^)]+)\)/g`
- Render with: `renderMentions(content)` helper

**Supported Emojis:**
`+1`, `-1`, `heart`, `smile`, `laugh`, `thinking`, `clap`, `fire`, `eyes`, `check`, `x`, `question`, `celebration`

**Meeting Link Providers:**
`ZOOM`, `GOOGLE_MEET`, `MICROSOFT_TEAMS`, `CUSTOM`

**Key Server Actions:**
```typescript
// Reactions
addReaction(postId, replyId, emoji)
removeReaction(reactionId)

// Mentions
getMentionableUsers(channelId)
getUserMentions()
markMentionAsRead(mentionId)

// Attachments
attachDocumentToPost(postId, replyId, documentId)
removeAttachment(attachmentId)

// Meeting Links
addMeetingLink(channelId, postId, provider, url, title)
removeMeetingLink(linkId)
```

**Features:**
- Public/private channels with role-based access
- Direct messages (1:1 conversations)
- @mention autocomplete with user search
- Emoji reactions with grouped counts
- Threaded replies on posts
- Pin/unpin posts
- File attachments linked to SharedDocument
- Meeting link integration with auto-detection
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

## Coach Prospect Pipeline

Tracks prospective coaches from initial assessment through payment and account creation.

**Key files:**
- `src/lib/actions/prospects.ts` - Prospect CRUD and status management
- `src/lib/actions/surveys.ts` - `getOrCreateCoachAssessment()`, `getCoachAssessmentLink()`
- `src/app/(dashboard)/admin/prospects/` - Admin prospect management
- `src/app/(public)/assessment/[surveyId]/` - Public assessment form (no login required)

**Route Structure:**
```
src/app/(public)/
├── layout.tsx                    # Minimal public layout
├── assessment/
│   └── [surveyId]/
│       ├── page.tsx              # Server component
│       └── assessment-client.tsx # Paginated form with progress bar
├── business-form/
│   └── [token]/
│       ├── page.tsx              # Server component
│       └── business-form-client.tsx # Business development form
├── acceptance/
│   └── [token]/
│       ├── page.tsx              # Server component
│       └── acceptance-client.tsx # Acceptance letter with payment
└── book/
    └── [slug]/
        ├── page.tsx              # Calendar booking page
        └── booking-client.tsx    # Slot selection UI

src/app/(dashboard)/admin/prospects/
├── page.tsx                      # Prospect list (server)
├── prospects-client.tsx          # List with pipeline view (client)
└── [id]/
    ├── page.tsx                  # Prospect detail (server)
    └── prospect-detail-client.tsx # Detail view (client)
```

**Prospect Status Flow:**
```
ASSESSMENT_PENDING → ASSESSMENT_COMPLETED → ORIENTATION_SCHEDULED →
ORIENTATION_COMPLETED → BUSINESS_FORM_PENDING → BUSINESS_FORM_SUBMITTED →
INTERVIEW_SCHEDULED → INTERVIEW_COMPLETED → APPROVED/REJECTED →
ACCEPTANCE_PENDING → PAYMENT_PENDING → PAYMENT_COMPLETED → ACCOUNT_CREATED
```

**Assessment Survey:**
- Auto-created with 3 required TEXT_LONG questions:
  1. "Are you passionate about youth development and in what way(s)?"
  2. "Are you committed to your personal success?"
  3. "Are you willing to go through continued transformation..."
- Shows progress bar and one question per page
- Collects prospect info: firstName, lastName, email, phone, referrerName
- Completion message: "Someone will reach out within 24 hours to schedule orientation"

**Getting the Assessment Link:**
```typescript
import { getCoachAssessmentLink } from '@/lib/actions/surveys'

const result = await getCoachAssessmentLink()
// result.assessmentLink = "/assessment/[surveyId]"
```

**Creating a Prospect Manually:**
```typescript
import { createManualProspect } from '@/lib/actions/prospects'

await createManualProspect({
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  phone: '555-1234',
  referrerName: 'Jane Smith',
})
```

**Admin UI Features:**
- "Get Assessment Link" button - generates shareable URL with copy functionality
- "Add Prospect" button - manual prospect creation form
- Pipeline view with status filtering
- Prospect detail page with status timeline and inline data display
- **Generated Links section** - Shows all generated links (business form, acceptance) with copy buttons for easy resending
- Status-based action buttons show "Copy Link" when tokens already exist
- **Delete Prospect** button with confirmation (blocked if coach account already created)

**Prospect Detail Page - Inline Data Display:**
The prospect detail page shows ALL submitted data inline (not in modals) for easy review:
- **Assessment Responses** - Auto-loaded on page mount, shows question/answer pairs
- **Business Development Form** - Company name, tagline, business type (displays custom value if "Other" was selected), bio, online presence, services, pricing, goals (if submitted)
- **Orientation Information** - Date and notes
- **Biz Dev Interview Information** - Date and notes
- **Terms & Payment** - Terms acceptance timestamp and payment details

**Assessment Fallback Lookup:**
For older prospects that may not have `assessmentSubmissionId` populated:
1. Primary: Use `assessmentSubmissionId` if available
2. Fallback 1: Find by `assessmentSurveyId` + `contactEmail`
3. Fallback 2: Find by coach assessment survey + `contactEmail`
4. Auto-links found submission to prospect for future lookups

**Business Development Form:**
- Public form accessed via token (no login required)
- Route: `/business-form/[token]`
- Multi-step form with 5 sections: Business Identity, Online Presence, Services & Packages, Target Audience, Goals
- Auto-saves progress every 3 seconds with debouncing
- **"Other" business type option** - When "Other" is selected under Business Type, a text input appears to enter a custom business type (stored in `businessTypeOther` field)
- Predefined business types: Life Coaching, Business Coaching, Executive Coaching, Health & Wellness Coaching, Career Coaching, Relationship Coaching, Financial Coaching, Consulting, Training & Workshops, Speaking & Keynotes, Other
- **Website URL** - Accepts URLs with or without `https://` prefix (auto-prepends if missing)
- **Save & Exit** - Shows confirmation dialog with options to continue editing or copy link for later
- **Resume Support** - Prospects can return to the same link and continue where they left off

**Link Modal with Email:**
When admin generates or views prospect links (business form, orientation, acceptance), a modal appears with:
- Copy Link button to copy the URL to clipboard
- Send Email button that opens the user's email client with pre-filled subject and body
- The modal displays the full link for reference

**Key State in prospect-detail-client.tsx:**
```typescript
const [showLinkModal, setShowLinkModal] = useState<'business-form' | 'orientation' | 'acceptance' | null>(null)
const [modalLink, setModalLink] = useState<string | null>(null)

const handleSendEmail = (link: string, type: 'business-form' | 'orientation' | 'acceptance') => {
  const subject = type === 'business-form'
    ? 'Complete Your Business Development Form - NowTransformed'
    : type === 'orientation'
      ? 'Schedule Your Orientation - NowTransformed'
      : 'Acceptance Letter & Payment - NowTransformed'
  // Opens mailto: link with pre-filled content
}
```

**Token-Based Orientation Booking:**
- Route: `/book/orientation/[token]`
- Prospects can book orientation appointments using their `orientationToken`
- Links to the coach's orientation calendar
- Creates CalendarBooking with prospect's info

**Program Fee:**
- Environment variable: `COACH_PROGRAM_FEE` (server-side) and `NEXT_PUBLIC_COACH_PROGRAM_FEE` (client-side)
- Default value: `1500` USD
- Used in acceptance page and payment processing

## Get Involved / One-A-Day (phase 1)

Invite-link funnel from first contact to a kept discovery call. Phase 2 (role choice, assessments, orientation, logins) and phase 3 (payments) are described in the subsection below.

**Flow:** `/join/[slug]` form (or the inviter adds someone on their One-A-Day page) → welcome email with a `/discovery/[token]` link → prospect books, moves or cancels a 30-minute call → admin records Kept or No-show.
**17 and under:** `/consent/[token]` email to the parent first (status `AWAITING_PARENT_CONSENT`; declining deletes the prospect). The prospect must tick that the parent will attend, and an admin cannot mark the call Kept unless the parent attended.

**Key files:**
- `src/lib/get-involved/core.ts` - pure rules and constants (slots, streaks, leaderboard ranking, cutoffs). Tested in `core.test.ts` (`npm test`)
- `src/lib/get-involved/server.ts` - server-only helpers (tokens, host matching, emails to inviters). Not `'use server'`, so nothing here is a public endpoint
- `src/lib/get-involved/emails.ts` - all email templates; every user value goes through `esc()`
- `src/lib/actions/get-involved.ts` - public actions (submit, consent, book, cancel, new link) plus `addPersonAsInviter`
- `src/lib/actions/discovery-admin.ts` - hosts, availability, outcomes, staff cancel (ADMIN only, not while impersonating)
- `src/app/api/cron/discovery-reminders/route.ts` - 24h and 1h reminders; needs header `x-cron-secret` = env `CRON_SECRET`
- Admin: `/admin/discovery-calls` (Calls, Availability, Hosts tabs), `/admin/one-a-day`. Coach/ambassador: `/coach/one-a-day`, `/ambassador/one-a-day`

**Rules:** calls 30 min; bookable 12h to 21 days ahead; prospect changes allowed until 2h before; email links valid 14 days; 2 no-shows → `PAUSED`; streak = at least one invite per Central-time day; the first inviter keeps the credit; leaderboard ranks by joined, then forms.
**Hosts:** only ADMIN users (sub-admins can't open the calls page, so they can't host). A prospect sees only times from active hosts who cover their age range and have weekly availability; the Hosts tab warns when an age range has no one. Bookings take a Postgres advisory lock so two people can't take the same slot.

### Phase 2/3: role journey

**Flow after the call:** the host records the call Kept and picks a role → `ASSESSMENT_PENDING` + email with 3 questions (`/journey/[token]/assessment`) → `ASSESSMENT_COMPLETED` → orientation recording (`/journey/[token]/orientation`; "remind me later" = `ORIENTATION_SCHEDULED` + `orientationRemindAt`) → `ORIENTATION_COMPLETED` → `/journey/[token]/join`: accept the role's terms, choose a password; free roles get their login at once (`ACCOUNT_CREATED`), paid roles go `PAYMENT_PENDING` → `PAYMENT_COMPLETED` → `ACCOUNT_CREATED`. SPONSOR has no login: role chosen → `DONATION_HANDOFF` (`/journey/[token]/give`). Not a fit at any point before payment → `NOT_A_FIT` + a kind email. 17 and under only see free roles (Youth ambassador, Volunteer); their emails are copied to the parent.

**Data model (all additive):**
- `enum GetInvolvedRole` (COACH, SERVICE_PROVIDER, COACH_SERVICE_PROVIDER, BUSINESS_AFFILIATE, RESOURCE_CENTER_OWNER, AMBASSADOR, YOUTH_AMBASSADOR, VOLUNTEER, SPONSOR), `enum RoleBilling` (ONE_TIME, MONTHLY, YEARLY, FREE, GIFT), new `ProspectStatus.DONATION_HANDOFF`.
- `GetInvolvedRoleConfig` (one row per role, edited at `/admin/role-settings`). **No row = defaults** from `DEFAULT_ROLE_CONFIGS` in `core.ts`, so nothing is seeded. Always read through `getRoleConfig()` / `listRoleConfigs()` (`roles.ts`), never the table directly. Questions are JSON, exactly 3, `{ text, type: SHORT_TEXT|CHOICE|SCALE_1_5, choices }`.
- `GetInvolvedRoleTerms`: append-only versions per role; live = highest version. A prospect is bound to `Prospect.acceptedTermsId` (onDelete Restrict). `getLiveTerms()` returns version 0 (id null) when none saved; `ensureLiveTerms(tx)` creates v1 when a prospect accepts.
- `Prospect` journey fields: `journeyRole`, `journeyRoleChosenAt/ById`, `roleConfigSnapshot` (copy of the settings when the role was chosen, so edits only affect new prospects; read with `prospectRoleConfig()`), `assessmentAnswers` (JSON `StoredAnswer[]`), `assessmentSentAt/SubmittedAt/ReminderSentAt`, `orientationWatchedAt/RemindAt/ReminderSentAt/CheckAnswer`, `roleTermsAcceptedAt`, `acceptedTermsId`, `pendingPasswordHash` (every role, kept from terms acceptance until the login exists, so a login made later by an admin, e.g. after matching a coach, uses the password the prospect chose), `userId` (unique, the login made at the end), `joinedAt`, `notAFitAt`, `notes` (`ProspectNote`).
- `ProspectPayment` reused (one per prospect) with new `journeyRole`, `billing`, `checkoutUrl` (unused by Invo), `stripeSubscriptionId`, `invoSessionId`, `invoClientRequestId`, `invoOrderId` (unique); old-pipeline rows have `journeyRole` null. `PaymentMethod` gained `INVO`. `InvoWebhookEvent` (`invo_webhook_events`) dedupes webhook deliveries.
- `DiscoveryCall`: `topicsCovered String[]`, `parentAttendeeName`, `parentAttendeeRelationship`.
- A Get Involved prospect is one with a `journeyToken`; the old coach pipeline (`prospects.ts`) uses the same statuses for prospects without one and is unchanged.

**Rules (`core.ts`, tested in `core.test.ts`):** `journeyOpen()` is still the Phase 1 booking rule (FORM_SUBMITTED, DISCOVERY_BOOKED only). Later steps each have one predicate: `canChooseRole` (until terms accepted), `canAnswerAssessment`, `canDoOrientation`, `canAcceptTerms`, `canPay`, `canCreateLogin`, `canMarkNotAFit` (not after PAYMENT_COMPLETED/ACCOUNT_CREATED), `laterJourneyOpen` (may ask for a fresh link). `journeyPosition()` gives the stage and next step from the fields; `stagePath()` the page; `railSteps()` the prospect's progress rail (Your info, [Parent's okay], Book a call, Discovery call, Assessment, Orientation, Join, Welcome; sponsors end at Give). Links under `/journey/[token]` work 14 days from `journeyTokenIssuedAt`. `refreshJourneyToken` ROTATES the token (always email the token it returns; the old link dies). `extendJourneyLink` only restarts the clock (in-page actions, cron reminders). `sendFreshJourneyLink(email)` (journey.ts) is the one path for "email me a new link": case-insensitive lookup, only for `canResendLink` statuses (never NOT_A_FIT, PAUSED, ACCOUNT_CREATED, DONATION_HANDOFF or awaiting consent), sends the current step's URL.

**Shared helpers (server only, not `'use server'`):** `roles.ts` (configs, terms, `saveRoleConfig`), `journey.ts` (`chooseRole`, `markNotAFit` + `afterNotAFitEmails`, `prospectForJourney`, `journeyLink`), `login.ts` (`completeJourney` creates User + profile, sets `ACCOUNT_CREATED` with history so the leaderboard's "joined" counts, sends E11 and "joined your team"), `payment.ts` (`openJourneyPayment`, `markJourneyPaid`). UI: `src/components/get-involved/journey-rail.tsx`. New email templates go in their own file under `src/lib/get-involved/emails/` (see its `index.ts`); `emails.ts` exports `layout`, `esc`, `P`, `SMALL`, `callBox`, `parentNote`, `notAFitEmail`.
**Status changes:** always through `transitionStatus` / `mustTransition` (server.ts): one conditional `updateMany where {id, status: from}` + history, refused unless `canMoveStatus(from, to)` (core.ts: journey moves + Phase 1 moves). Of two concurrent moves only one wins; callers catch `isStatusConflict` and ask the user to reload. `setStatus` is legacy, do not use it for journey prospects. Assessment submits carry a role marker (`assessmentMarkerMatches`) so answers can't land on a changed role; terms are re-checked inside the accept transaction (`termsStillMatch`).
**Needs a coach:** an ambassador/youth ambassador whose inviter has no coach can't get a login automatically (`completeJourney` fails with `NEEDS_COACH`). The Join page says a coach is being matched; admins get one notice; the record's "Needs a coach" card runs `assignCoachAndCreateLogin`, which also runs `afterLoginExtras` (`src/lib/get-involved/after-login.ts`: onboarding tasks, parent login for 17 and under).
**Who can invite:** only COACH and AMBASSADOR users (`canInvite`); `inviterBySlug` rejects others and the welcome page only creates invite links for them. "Add someone" (`addPersonAsInviter`) is limited to 20 a day per user and never reveals another inviter's prospects. Emails are matched case-insensitively (`emailEquals`) and new Users are stored lowercased.
**Classic pipeline:** the older coach pipeline tab, its stats and `prospects.ts` actions exclude Get Involved prospects (`journeyToken` set); `?view=classic` is read-only for them, and `createCoachFromProspect`/`deleteProspect`/`approveManualPayment` refuse them. Deleting a User who hosts upcoming booked calls is refused (`src/lib/prospect-pipeline.ts`).
**Discovery extras:** hosts can block off dates (`DiscoveryBlockedDate`, slots skip them, including the booking re-check; helpers in `discovery-slots.ts`); admins can move a call (`call-tools.ts`); the booked screen offers add-to-calendar (`/discovery/[token]/calendar`, .ics), change and cancel; with no open times the prospect can ask to be told or contacted (`DiscoverySlotRequest`) and admins get at most one alert per prospect per Central day. Admin times show Central with a zone label.
**Leaderboard:** `/admin/one-a-day` has a month picker, Team size, CSV export, a Youth ambassadors tab and "People active today" (`leaderboard-period.ts`); inviters' lists show each person's real step (`inviter-people.ts`).
**Env:** `COMMUNITY_EVENTS_URL` (optional) adds the "See upcoming community events" button to the Not a fit email.

### Payments (Invo, one-time roles)

**On/off:** online payment is ON only when both `INVO_SECRET_KEY` and `INVO_WEBHOOK_SECRET` are set (`getPaymentProvider()` / `isOnlinePaymentEnabled()` in `src/lib/payments.ts`). The key prefix picks the environment: `ivsdk_test_...` = sandbox (`https://sandbox.invo.network/sandbox`), `ivsdk_live_...` = production (`https://invo.network`); `INVO_API_BASE` overrides. Off = the manual path below for everyone.
**ONE_TIME roles only.** MONTHLY/YEARLY roles stay on the manual path even when Invo is on (Invo subscriptions need a hosted card-setup session and a live title; not built). `onlinePaymentAvailableFor(billing)` is the check.
**Flow:** accepting a paid role's terms opens a PENDING payment (`INVO` if online for that billing, else `MANUAL`) and moves to `PAYMENT_PENDING`. The Join page shows "Pay $X and create my login"; each click calls `startJourneyCheckout(token)` (`src/lib/actions/journey-join.ts`), which validates the token, `PAYMENT_PENDING`, and that the snapshot price equals the payment row, rate limits, saves a NEW `invoClientRequestId`, calls `POST /api/platform-commerce/purchase` (card, metadata `prospect_id` + `payment_id`), saves `invoSessionId`, and the browser goes to `checkout_url`. Checkout links are single use and expire in ~15 minutes, so none is stored for later. Return: `success_url` = `/journey/[token]/join?paid=1` ("we're setting up your login", refreshes until the login exists, then shows the welcome link); `cancel_url` = `?cancelled=1` (gentle note, Pay again). A failed Invo call shows a friendly message; setup failures (bad key, account not platform-tagged, amount refused) also notify admins (at most hourly per prospect).
**Webhook:** `src/app/api/webhooks/invo/route.ts` (nodejs, raw body) → `processInvoWebhook` in `src/lib/payments/invo-webhook.ts` (pure, tested) with Prisma deps in `invo-webhook-db.ts`. Verifies `X-Invo-Signature` (HMAC-SHA256 of `${t}.${rawBody}` keyed with the full `whsec_` secret, any `v1`, 300 s tolerance; 401 otherwise), dedupes on `X-Invo-Idempotency-Key` (never on `X-Invo-Event-Id`). `platform_commerce.purchased`: grants only when the payment row (by `metadata.payment_id`, else `client_request_id`), prospect id, ONE_TIME billing, amount (`total_price_usd` or, if tax was added, `item_price_usd` equals the payment) and `PAYMENT_PENDING` all match → `markJourneyPaid(prospectId, { method: 'INVO', invoOrderId })` → login + emails + `afterLoginExtras`. Anything else is logged + `notifyAdmins`, never granted (a second payment for an already-paid row is flagged for refund). `platform_commerce.refunded`: full refund → payment `REFUNDED` + admin notification; the login is NOT removed (partial refunds only notify). Unknown events → 200, ignored. A crash releases the dedupe row and returns 500 so Invo retries.
**Manual path (always available):** `/admin/journey-payments` lists waiting payments; "Mark payment received" works for every payment, online or not, and shows the Invo state (off / test / live, webhook secret set or not).
**Register the webhook (once, by an admin with the key; not done by the app):** `PUT https://api.invo.network/api/dev/webhooks/games/<GAME_ID>` with `target_url` = `{APP_URL}/api/webhooks/invo` and `subscribed_events` = `platform_commerce.purchased`, `platform_commerce.refunded`. Put the returned `whsec_...` secret in `INVO_WEBHOOK_SECRET`.
**Go-live checklist:** 1) the Invo account must be platform-tagged (else 403 `NOT_A_PLATFORM_TENANT`); 2) set the sandbox key `ivsdk_test_...` + webhook secret, register the webhook, pay a one-time role end to end with card 4242 4242 4242 4242 and confirm the login is created and `/admin/journey-payments` shows it paid (also try a refund); 3) switch to the `ivsdk_live_...` key and the live webhook secret (mixing environments gives 401 `KEY_FOR_OTHER_ENVIRONMENT`). Card minimum is $2.99. Fallback read if a webhook is missed: `GET {base}/api/platform-commerce/purchase-status/{order_id}` (not wired up).
**Routes added to the sidebar:** `/admin/role-settings` (People), `/coach/my-team`, `/ambassador/my-team`.

## Surveys & Quizzes

Unified survey builder for creating quizzes and surveys with multi-question page support:

**Key files:**
- `src/lib/actions/surveys.ts` - All survey server actions
- `src/app/(dashboard)/admin/surveys/new/` - New survey builder page
- `src/app/(dashboard)/admin/surveys/[id]/` - Survey editor page (with page management)
- `src/app/(dashboard)/admin/surveys/[id]/results/` - Results analytics
- `src/app/(dashboard)/coach/surveys/` - Coach survey list and taking
- `src/app/(dashboard)/ambassador/surveys/` - Ambassador survey list and taking
- `src/app/(public)/assessment/[surveyId]/` - Public assessment form

**Database models:**
- `Survey` - Quiz or Survey with settings (passingScore, allowRetake, showResults, isAnonymous)
- `SurveyPage` - Page/section with title, description, and sortOrder (groups multiple questions)
- `SurveyQuestion` - Question with type, pageId (nullable for standalone questions)
- `SurveyOption` - Options for choice questions (with isCorrect for quizzes)
- `SurveySubmission` - User submission with score/pass status (includes `contactEmail` for public surveys)
- `SurveyAnswer` - Individual question answers

**Creating a survey (Admin workflow):**
1. Navigate to Admin → Surveys & Quizzes
2. Click "Add Quiz" or "Add Survey" → goes to `/admin/surveys/new`
3. Configure settings (title, type, roles, passing score, etc.)
4. Click "Create & Add Questions"
5. Add questions inline with the question form
6. Questions support: Multiple Choice, Multiple Select, Likert Scale, Short Text, Long Text
7. Reorder questions with up/down arrows
8. Duplicate questions with copy button
9. Publish when ready

**Page Management (multi-question pages):**
Pages allow grouping multiple questions on a single screen with section titles and descriptions.

- Click "Add Page/Section" button (purple) to create a new page
- Set optional title (e.g., "Personal Information") and description
- Add questions directly to a page using the folder+ icon on the page header
- Move existing questions between pages using the dropdown on each question
- Questions without a page are shown as "Standalone Questions"
- Pages are displayed with purple background in the editor
- When respondents take the survey, all questions on a page appear together

**Page Server Actions:**
```typescript
import {
  createSurveyPage,
  updateSurveyPage,
  deleteSurveyPage,
  moveQuestionToPage,
  addQuestionToPage,
} from '@/lib/actions/surveys'

// Create a page
await createSurveyPage(surveyId, { title: 'Section 1', description: 'Instructions...' })

// Move question to a page (or null for standalone)
await moveQuestionToPage(questionId, pageId)

// Add question directly to a page
await addQuestionToPage(surveyId, pageId, questionData)
```

**Survey editor features:**
- Optimistic UI updates (no page refresh)
- Question reordering with arrow buttons
- Question duplication
- Inline settings editing
- Live preview for Likert scales
- Page management with edit/delete buttons
- Move-to-page dropdown on each question
- **Preview button** - Opens survey in new tab with preview mode (admin only)

**Preview Mode:**
- Access via "Preview" button in survey editor or `?preview=true` URL parameter
- Shows amber banner: "Preview Mode - Responses will not be saved"
- Allows skipping required fields for quick navigation
- "Submit" shows completion screen without saving to database
- Only accessible to admin users (redirects to login otherwise)
- Works with draft surveys (doesn't require publishing first)

**Contact Info Configuration:**
Surveys can collect respondent contact information before the questions. Configure this in the Survey Settings panel.

- **Toggle**: "Collect Contact Information" switch enables/disables the feature
- **Required Fields** (always collected when enabled):
  - First Name
  - Last Name
  - Email
- **Optional Fields** (can be enabled/disabled):
  - Phone - Toggle on/off, optionally mark as required
  - Referrer Name - Toggle on/off, optionally mark as required

The configuration is stored in `contactInfoConfig` (JSON field) and `requiresProspectInfo` (boolean).

**Additional Survey Settings:**
- `isPublic` - When true, survey doesn't require login (for public assessments)
- `showProgressBar` - Toggle progress bar visibility during survey taking
- `requiresProspectInfo` - Enable contact info collection form

**Survey taking experience (Coach/Ambassador):**
- Paginated display (pages show all questions together, standalone questions show one per screen)
- Page titles and descriptions displayed as section headers
- Progress bar showing "Step X of Y" and percentage
- Previous/Next navigation buttons
- Validation for all questions on current step before proceeding
- Submit button on final step

**Server actions:**
```typescript
import {
  createSurvey,
  addQuestion,
  updateQuestion,
  deleteQuestion,
  reorderQuestions,
  duplicateQuestion,
  submitSurvey,
  getSurveyResults
} from '@/lib/actions/surveys'

// Duplicate a question
const result = await duplicateQuestion(questionId)
// Returns: { success: true, question: { id, questionText, pageId, ... } }

// Reorder questions
await reorderQuestions(surveyId, ['questionId1', 'questionId2', ...])
```

**Question types:**
| Type | Description | Quiz scoring |
|------|-------------|--------------|
| MULTIPLE_CHOICE | Single answer from options | 1 correct answer |
| MULTIPLE_SELECT | Multiple answers from options | All correct, no incorrect |
| LIKERT_SCALE | Rating scale (e.g., 1-5) | Not scored |
| TEXT_SHORT | Single line text | Not scored |
| TEXT_LONG | Paragraph text | Not scored |

## Business Ideas

Ambassador business idea submission and admin review workflow:

**Key files:**
- `src/lib/actions/business-idea.ts` - Server actions for save, submit, review
- `src/app/(dashboard)/ambassador/business-idea/page.tsx` - Status/list page
- `src/app/(dashboard)/ambassador/business-idea/edit/page.tsx` - Edit form page
- `src/app/(dashboard)/admin/business-ideas/business-ideas-client.tsx` - Admin review page

**Ambassador workflow:**
1. Navigate to Business Idea from sidebar
2. Status page shows current status and links to edit
3. Click "Create" or "Edit" to go to edit page
4. Fill in title, description, target market, resources
5. Save as draft or submit for review
6. After save/submit, redirects to status page with toast notification

**Admin review workflow:**
1. Navigate to Admin → Business Ideas
2. Click on an idea to view full details in modal
3. Review dialog shows: title, ambassador, coach, status, submission date
4. Full details: business description, target market, resources needed
5. Status options: Mark In Progress, Approve, Request Revision, Reject
6. "UNDER_REVIEW" status indicates admin is actively reviewing

**Status values:**
- `DRAFT` - Ambassador is editing, not yet submitted
- `SUBMITTED` - Ambassador submitted, awaiting review
- `UNDER_REVIEW` - Admin marked as "In Progress"
- `APPROVED` - Business idea approved
- `NEEDS_REVISION` - Sent back to ambassador for changes
- `REJECTED` - Not approved

## Sidebar Navigation

Collapsible accordion-style sidebar navigation:

**Key file:** `src/components/dashboard/sidebar.tsx`

**Behavior:**
- Menu items organized into collapsible sections
- Only one section open at a time (accordion behavior)
- Clicking a section closes any other open section
- Clicking top-level items (Dashboard, Onboarding) closes all sections
- Active section auto-expands on navigation

**Ambassador sections:**
- Assessments (Surveys & Quizzes)
- Learning (Courses, Old Classes, Knowledge Base)
- Business (Business Idea)
- Tools (Time Clock, Schedule, Collaboration)
- Account (Profile)

**Coach sections:**
- People (Ambassadors)
- Assessments (Surveys & Quizzes)
- Business (CRM, Projects, Business Excellence, Income & Goals)
- Content (My Classes, Courses, Knowledge Base)
- Communication (Collaboration, Messages)
- Tools (Time, Schedule, Events, Sponsorship, Resource Center)

**Admin sections:**
- People (Prospects, User Management, Coaches, Ambassadors)
- Assessments (Surveys & Quizzes)
- Onboarding & Training (Onboarding Config, Amb. Onboarding, Courses & Quizzes, Business Ideas)
- Content (All Classes, Knowledge Base, Resource Centers)
- Events & Finance (Calendars, Events, Sponsorship Requests, Business Excellence)
- Communication (Channels, Direct Messages, Files)
- System (Feature Config, Reports, Audit Logs, Settings)

## Onboarding Journey Component

Visual progress tracking component for onboarding:

**Key file:** `src/components/ui/onboarding-journey.tsx`

**Components:**
- `OnboardingJourney` - Full horizontal stepper with progress bar
- `OnboardingJourneyCompact` - Compact version for sidebars

**Features:**
- Visual stepper with icons for each step
- Color-coded status: green (completed), amber (current), gray (pending)
- Animated "You are here" marker on current step
- Progress percentage indicator
- "Next step" pill showing upcoming task
- Responsive design (scrollable on mobile)

**Usage:**
```typescript
import { OnboardingJourney, OnboardingStep } from '@/components/ui/onboarding-journey'

const steps: OnboardingStep[] = [
  { id: '1', title: 'Step 1', description: '...', icon: CheckIcon, status: 'completed' },
  { id: '2', title: 'Step 2', description: '...', icon: FileIcon, status: 'current', link: '/path' },
  { id: '3', title: 'Step 3', description: '...', icon: StarIcon, status: 'pending' },
]

<OnboardingJourney steps={steps} completedCount={1} totalCount={3} />
```

## Toast Notifications

Custom toast notification pattern used in business idea forms:

**Pattern (in component):**
```typescript
const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

const showToast = useCallback((message: string, type: 'success' | 'error') => {
  setToast({ message, type })
}, [])

// In JSX:
{toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
```

**Toast component features:**
- Auto-dismiss after 4 seconds
- Green (success) or red (error) styling
- Slide-in animation from bottom-right
- Close button for manual dismiss

## LMS (Learning Management System)

Modern learning management system with hierarchical course structure, multiple content types, and progress tracking.

**Key files:**
- `src/lib/actions/lms/courses.ts` - Course CRUD operations
- `src/lib/actions/lms/modules.ts` - Module management
- `src/lib/actions/lms/lessons.ts` - Lesson management
- `src/lib/actions/lms/content-blocks.ts` - Content block management
- `src/lib/actions/lms/enrollment.ts` - Enrollment and progress tracking
- `src/lib/actions/lms/analytics.ts` - Admin analytics

**Route Structure:**
```
src/app/(dashboard)/admin/lms/
├── page.tsx                    # Course list (server)
├── lms-admin-client.tsx        # Course list (client)
├── new/                        # Create course
├── [courseId]/
│   ├── page.tsx                # Course editor (server)
│   └── course-editor-client.tsx # Editor (client)
└── analytics/
    ├── page.tsx                # Analytics dashboard (server)
    └── lms-analytics-client.tsx # Analytics (client)

src/app/(dashboard)/coach/learning/
├── page.tsx                    # Course catalog (server)
├── learning-catalog-client.tsx # Catalog (client)
├── [courseId]/
│   ├── page.tsx                # Course view (server)
│   └── course-view-client.tsx  # Course view (client)
│   └── [lessonId]/
│       ├── page.tsx            # Lesson viewer (server)
│       └── lesson-viewer-client.tsx # Viewer (client)

src/app/(dashboard)/ambassador/learning/  # Same structure as coach
```

**Database Models:**

| Model | Purpose |
|-------|---------|
| `LMSCourse` | Course container with title, description, thumbnail, status, allowedRoles |
| `LMSModule` | Section/chapter within a course |
| `LMSLesson` | Individual learning unit within a module |
| `LMSContentBlock` | Content piece: VIDEO, TEXT, QUIZ, or DOCUMENT |
| `LMSEnrollment` | User enrollment with overall progress |
| `LMSLessonProgress` | Per-lesson completion tracking |
| `LMSContentProgress` | Per-content block progress (video watch %, quiz scores) |

**Content Types:**

| Type | Content JSON | Completion Criteria |
|------|--------------|---------------------|
| VIDEO | `{ url, provider, duration }` | Watch 80%+ |
| TEXT | `{ content, format }` | View/scroll |
| QUIZ | `{ surveyId, passingScore }` | Links to Survey system |
| DOCUMENT | `{ url, fileName, fileSize }` | Download/view |

**Course Status Flow:**
- `DRAFT` - Course is being built, not visible to learners
- `PUBLISHED` - Course is visible and enrollable
- `ARCHIVED` - Course is hidden but data preserved

**Enrollment Status:**
- `NOT_STARTED` - Enrolled but no progress
- `IN_PROGRESS` - Started but not completed
- `COMPLETED` - All lessons marked complete

**Admin Actions:**
```typescript
import { createCourse, updateCourse, publishCourse, archiveCourse } from '@/lib/actions/lms/courses'
import { createModule, reorderModules } from '@/lib/actions/lms/modules'
import { createLesson, reorderLessons } from '@/lib/actions/lms/lessons'
import { createContentBlock } from '@/lib/actions/lms/content-blocks'

// Create a course
const course = await createCourse({
  title: 'Getting Started',
  description: 'Introduction course',
  allowedRoles: ['COACH', 'AMBASSADOR'],
})

// Add module
const module = await createModule(course.id, { title: 'Module 1' })

// Add lesson
const lesson = await createLesson(module.id, { title: 'Lesson 1' })

// Add content block
await createContentBlock(lesson.id, {
  type: 'VIDEO',
  title: 'Welcome Video',
  content: { url: 'https://youtube.com/...', provider: 'youtube' },
})
```

**Learner Actions:**
```typescript
import {
  getAvailableCourses,
  enrollInCourse,
  getLessonContent,
  updateContentProgress,
  markLessonComplete,
} from '@/lib/actions/lms/enrollment'

// Get courses for current user's role
const courses = await getAvailableCourses()

// Enroll in a course
await enrollInCourse(courseId)

// Track video progress
await updateContentProgress(contentBlockId, 75) // 75% watched

// Mark lesson complete
await markLessonComplete(lessonId)
```

**Analytics Actions (Admin):**
```typescript
import {
  getLMSOverviewStats,
  getCourseAnalytics,
  getAllEnrollments,
  getRecentActivity,
} from '@/lib/actions/lms/analytics'

// Overview statistics
const stats = await getLMSOverviewStats()
// Returns: totalCourses, publishedCourses, totalEnrollments, completionRate, etc.

// Per-course analytics
const courseStats = await getCourseAnalytics()
// Returns: enrollments, completion rates, avg progress per course
```

**Migration Script:**
To migrate from old Course model to new LMS:
```bash
npx tsx scripts/migrate-courses-to-lms.ts
```

**Client Component Props:**
The learning client components accept a `basePath` prop for role-agnostic navigation:
```typescript
// Coach uses default basePath
<LearningCatalogClient courses={courses} enrollments={enrollments} />

// Ambassador passes custom basePath
<LearningCatalogClient
  courses={courses}
  enrollments={enrollments}
  basePath="/ambassador/learning"
/>
```

## Calendar Events as Bookable Availability

CalendarEvents can be used as bookable availability for prospects. When an admin creates a CalendarEvent on a calendar, it automatically becomes available as a bookable slot.

**Key files:**
- `src/lib/actions/admin-calendars.ts` - Modified to include events as bookable slots

**How It Works:**
- `getAvailableDatesForMonth()` fetches CalendarEvents and includes dates with events in the available dates
- `getAvailableSlots()` returns events as slots with `id: event_${event.id}` prefix
- `createPublicBooking()` handles event bookings when slotId starts with `event_`
- Events have a capacity of 1 by default

**Database Changes:**
```prisma
model CalendarBooking {
  ...
  eventId         String?
  event           CalendarEvent?  @relation(fields: [eventId], references: [id], onDelete: SetNull)
  ...
}

model CalendarEvent {
  ...
  bookings       CalendarBooking[]
  ...
}
```

## Migration API Endpoint

A secure endpoint for running database migrations on production without direct database access.

**Key file:** `src/app/api/admin/migrate/route.ts`

**Endpoint:** `GET/POST /api/admin/migrate`
- GET: Returns migration status (pending, completed, available migrations)
- POST: Runs all pending migrations

**Authentication:**
- Admin session (via NextAuth)
- Or `MIGRATION_SECRET` environment variable in `x-migration-secret` header

**Adding New Migrations:**
```typescript
const MIGRATIONS = [
  {
    id: '2026_01_21_add_orientation_token',
    description: 'Add orientationToken to Prospect',
    sql: 'ALTER TABLE "Prospect" ADD COLUMN IF NOT EXISTS "orientationToken" TEXT',
  },
  // Add more migrations here
]
```

**Usage:**
```bash
# Check migration status
curl -H "x-migration-secret: YOUR_SECRET" https://your-app.com/api/admin/migrate

# Run pending migrations
curl -X POST -H "x-migration-secret: YOUR_SECRET" https://your-app.com/api/admin/migrate
```

## Environment Variables

Key environment variables for the application:

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | - |
| `NEXTAUTH_SECRET` | Secret for NextAuth JWT — generate with `openssl rand -hex 32` | - |
| `NEXTAUTH_URL` | Application URL | http://localhost:3000 |
| `COACH_PROGRAM_FEE` | Program fee in USD (server-side) | 1500 |
| `NEXT_PUBLIC_COACH_PROGRAM_FEE` | Program fee in USD (client-side) | 1500 |
| `MIGRATION_SECRET` | Secret for migration API authentication — generate with `openssl rand -hex 32` | - |
| `EMAIL_FROM` | Sender address for password reset emails (production only) | - |
| `RESEND_API_KEY` | Resend API key (or use another provider; see `src/lib/email.ts`) | - |
| `CRON_SECRET` | Shared secret for `/api/cron/discovery-reminders` (16+ chars), sent as header `x-cron-secret` | - |
| `APP_URL` | Base URL used in email links; falls back to `NEXTAUTH_URL` | - |
| `INVO_SECRET_KEY` | Invo secret key, server only. `ivsdk_test_...` = sandbox, `ivsdk_live_...` = production. With `INVO_WEBHOOK_SECRET` it turns on online payment for one-time Get Involved roles | - (off) |
| `INVO_WEBHOOK_SECRET` | Full `whsec_...` secret for verifying `{APP_URL}/api/webhooks/invo` | - (off) |
| `INVO_API_BASE` | Optional Invo API base URL override (normally chosen from the key prefix) | - |
