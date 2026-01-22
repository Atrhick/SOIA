# CLAUDE.md - AI Assistant Context

This file provides context for AI assistants working on the StageOneInAction Back Office codebase.

## Project Overview

This is a **Next.js 14** web application for managing coaches and ambassadors in the StageOneInAction organization. It's a comprehensive back-office platform with role-based access for Admins, Coaches, and Ambassadors.

### Key Features
- **Coach Prospect Pipeline**: Public assessment surveys for prospective coaches with automatic prospect tracking through the onboarding pipeline
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
- `TimeClockEntry` / `TimeEntry` - Time tracking (attendance + project-based)
- `CalendarEvent` / `EventAttendee` - Scheduling and calendar
- `KBCategory` / `KBArticle` - Knowledge base with publishing workflow

### Coach Prospect Pipeline Models

- `Prospect` - Prospective coach tracking through onboarding pipeline
- `ProspectStatusHistory` - Audit trail of status changes
- `ProspectPayment` - Payment tracking (Stripe, PayPal, Manual)
- `AdminNotification` - In-app notifications for admins

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

**Header Profile Name Display:**
The header displays the user's profile name (firstName + lastName) for coaches and ambassadors, fetched from `CoachProfile` or `Ambassador` model respectively. Falls back to email if name is not available. The dashboard layout (`src/app/(dashboard)/layout.tsx`) fetches the profile name and passes it to the Header component.

**Key files:**
- `src/lib/actions/impersonation.ts` - Server actions for impersonation
- `src/components/dashboard/header.tsx` - Dropdown menu with impersonation UI, displays profile name
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
- **Business Development Form** - Company name, bio, services, pricing (if submitted)
- **Orientation Information** - Date and notes
- **Interview Information** - Date and notes
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
- Fields: Company name, bio, vision/mission statements, services, pricing
- **"Other" service option** - Prospects can select "Other" and enter a custom service not in the predefined list
- Predefined services: Life Coaching, Mentoring Services, Training & Workshops, Business Consulting, Public Speaking, Writing & Content

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
