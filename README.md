# StageOneInAction Back Office

A comprehensive web-based platform for managing coaches, ambassadors, and organizational operations for StageOneInAction's four pillars: Personal Development, Professional Development, Talent Development, and Community Involvement.

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Database Setup](#database-setup)
  - [Running the Application](#running-the-application)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [Authentication](#authentication)
- [User Roles](#user-roles)
- [API Routes](#api-routes)
- [Feature Documentation](#feature-documentation)
- [Development](#development)
- [Deployment](#deployment)

---

## Overview

The StageOneInAction Back Office provides:

**For Ambassadors (Ages 10-24):**
- Personal login portal with onboarding journey
- **Editable profile** with photo URL, bio, and social media links
- Business idea submission and review workflow
- Class enrollment (free and paid classes from coaches)
- Progress tracking through onboarding steps
- WhatsApp support team and Power Team integration
- **Parental consent flow** for ambassadors under 18 (parent/guardian gets their own login)
- **Time Clock** - Clock in/out for attendance tracking
- **Collaboration** - Access to team discussion channels
- **Scheduling** - View calendar and RSVP to events
- **Knowledge Base** - Browse articles and documentation

**For Coaches:**
- Complete onboarding and compliance tracking
- Ambassador management and monitoring
- Class creation and management for ambassadors
- Business Excellence tools (CRM, website readiness, marketing outreach)
- Weekly goals and income tracking
- Event qualification and RSVP
- Sponsorship requests
- Direct messaging with administrators
- **CRM** - Contacts, deals, pipeline stages, and activity tracking
- **Project Management** - Projects with tasks and milestones
- **Collaboration** - Team discussions and document sharing
- **Time Tracking** - Clock in/out and project-based time logging
- **Scheduling** - Calendar events and meeting management
- **Knowledge Base** - Browse articles and documentation

**For Administrators:**
- Coach and ambassador management
- **User impersonation** - Login as any coach or ambassador to view their experience (with visual banner indicator)
- **Create ambassador accounts** - Add ambassadors and assign them to coaches with enhanced form inputs
- **Parental consent management** - Automatic parent account creation for ambassadors under 18
- **User Management** - Create user accounts and configure per-user feature permissions (grant/deny access)
- **Feature Configuration** - Enable/disable business tools per role with admin toggle dashboard
- Ambassador onboarding review (interviews, approvals)
- Business idea review and feedback
- Onboarding configuration
- Course and quiz management
- Event creation and qualification settings
- Sponsorship request review
- Resource Center application review
- Knowledge Base management - Create and publish articles for coaches/ambassadors
- Collaboration management - Create discussion channels and manage shared documents
- Reporting and exports

**For Parents/Guardians:**
- Login access to monitor their child's ambassador account (for ambassadors under 18)
- View ambassador profile and progress

---

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 14.2.x | React framework with App Router |
| **TypeScript** | 5.x | Type-safe JavaScript |
| **PostgreSQL** | 15 | Relational database |
| **Prisma** | 5.x | ORM and database toolkit |
| **NextAuth.js** | 5 (beta) | Authentication |
| **Tailwind CSS** | 3.x | Utility-first CSS framework |
| **Docker** | - | Database containerization (optional) |
| **Zod** | 3.x | Schema validation |
| **bcryptjs** | - | Password hashing |
| **Lucide React** | - | Icon library |

---

## Features

### Implemented Features

| Feature | Ambassador | Coach | Admin | Status |
|---------|------------|-------|-------|--------|
| Authentication & Login | ✅ | ✅ | ✅ | Complete |
| Dashboard | ✅ | ✅ | ✅ | Complete |
| Onboarding Checklist | ✅ | ✅ | - | Complete |
| Profile Management (with photo & social links) | ✅ | ✅ | ✅ | Complete |
| User Impersonation | - | - | ✅ | Complete |
| Ambassador Management | - | ✅ | ✅ | Complete |
| Create Ambassador Accounts | - | ✅ | ✅ | Complete |
| Ambassador Onboarding Review | - | - | ✅ | Complete |
| Business Idea Submission | ✅ | - | ✅ | Complete |
| Class Enrollment | ✅ | - | - | Complete |
| Class Management | - | ✅ | ✅ | Complete |
| Income & Goals Tracking | - | ✅ | - | Complete |
| Sponsorship Requests | - | ✅ | ✅ | Complete |
| Messaging System | - | ✅ | ✅ | Complete |
| Events & RSVP | - | ✅ | ✅ | Complete |
| Coach Management | - | - | ✅ | Complete |
| Business Excellence | - | ✅ | - | Complete |
| Resource Center | - | ✅ | ✅ | Complete |
| Training Courses | - | ✅ | ✅ | Complete |
| Reports & Analytics | - | - | ✅ | Complete |
| Feature Configuration | - | - | ✅ | Complete |
| User Management | - | - | ✅ | Complete |
| Per-User Feature Permissions | - | - | ✅ | Complete |
| CRM | - | ✅ | ✅ | Complete |
| Project Management | - | ✅ | - | Complete |
| Collaboration (Channels) | - | ✅ | ✅ | Complete |
| Shared Documents | - | ✅ | ✅ | Complete |
| Time Clock | ✅ | ✅ | ✅ | Complete |
| Scheduling & Calendar | ✅ | ✅ | ✅ | Complete |
| Knowledge Base | ✅ | ✅ | ✅ | Complete |

### Future Enhancements

- Audit Logs
- Admin Settings
- Email Notifications
- Payment Integration for Paid Classes

---

## Getting Started

### Prerequisites

- **Node.js** 18.x or higher
- **npm** or **yarn**
- **PostgreSQL** 15 or higher (native installation or Docker)
- **pgAdmin** (optional, for database management)

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd test_app
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

### Environment Variables

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL="postgresql://stageoneinaction:stageoneinaction_dev_2024@localhost:5432/stageoneinaction?schema=public"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here-change-in-production"
```

### Database Setup

#### Option A: Native PostgreSQL (Recommended)

1. **Install PostgreSQL 15+:**
   - **Windows:** Download from https://www.postgresql.org/download/windows/
   - **macOS:** `brew install postgresql@15`
   - **Linux:** `sudo apt-get install postgresql-15`

2. **Quick Setup (Windows):**
   ```powershell
   # Run the automated setup script
   .\scripts\setup-windows.ps1
   ```

3. **Manual Setup (All Platforms):**

   Create the database user and database:
   ```sql
   -- Run as postgres superuser
   CREATE USER stageoneinaction WITH PASSWORD 'stageoneinaction_dev_2024';
   CREATE DATABASE stageoneinaction OWNER stageoneinaction;
   GRANT ALL PRIVILEGES ON DATABASE stageoneinaction TO stageoneinaction;
   ```

   Or use the provided SQL script:
   ```bash
   psql -U postgres -f scripts/setup-db.sql
   ```

4. **Initialize the schema:**
   ```bash
   npx prisma db push
   npx prisma db seed
   ```

#### Option B: Docker (Alternative)

1. **Start PostgreSQL with Docker:**
   ```bash
   docker-compose up -d
   ```

2. **Push the database schema:**
   ```bash
   npx prisma db push
   ```

3. **Seed the database with demo data:**
   ```bash
   npx prisma db seed
   ```

#### View the Database (Optional)

```bash
npx prisma studio
```
Opens at http://localhost:5555

### Running the Application

**Development mode:**
```bash
npm run dev
```
Opens at http://localhost:3000

**Production build:**
```bash
npm run build
npm start
```

### Demo Credentials

| Role | Email | Password | Login URL |
|------|-------|----------|-----------|
| Admin | admin@stageoneinaction.com | admin123 | /login |
| Coach | coach@stageoneinaction.com | coach123 | /login |
| Ambassador | ambassador@stageoneinaction.com | ambassador123 | /ambassador-login |

---

## Project Structure

```
test_app/
├── docs/
│   └── project.txt              # Project requirements document
├── prisma/
│   ├── schema.prisma            # Database schema (24+ models)
│   └── seed.ts                  # Database seed script
├── src/
│   ├── app/
│   │   ├── (auth)/              # Authentication pages
│   │   │   ├── login/           # Admin/Coach login
│   │   │   ├── ambassador-login/ # Ambassador login portal
│   │   │   ├── forgot-password/ # Password reset
│   │   │   └── layout.tsx       # Auth layout with animations
│   │   ├── (dashboard)/         # Dashboard routes (protected)
│   │   │   ├── admin/           # Admin pages
│   │   │   │   ├── ambassadors/ # Ambassador management
│   │   │   │   ├── ambassador-onboarding/ # Review ambassador onboarding
│   │   │   │   ├── business-ideas/ # Review business ideas
│   │   │   │   ├── classes/     # All classes overview
│   │   │   │   ├── coaches/     # Coach management (list, detail, new)
│   │   │   │   ├── collaboration/ # Channel management
│   │   │   │   ├── courses/     # Course & quiz configuration
│   │   │   │   ├── events/      # Event management
│   │   │   │   ├── features/    # Feature toggle configuration
│   │   │   │   ├── knowledge-base/ # Article management
│   │   │   │   ├── messages/    # Message threads
│   │   │   │   ├── reports/     # Reports & analytics
│   │   │   │   ├── resource-centers/ # Resource center applications
│   │   │   │   ├── sponsorship/ # Sponsorship review
│   │   │   │   ├── users/       # User management & permissions
│   │   │   │   └── page.tsx     # Admin dashboard
│   │   │   ├── ambassador/      # Ambassador pages
│   │   │   │   ├── business-idea/ # Submit/edit business idea
│   │   │   │   ├── classes/     # Browse and enroll in classes
│   │   │   │   ├── collaboration/ # Team discussions
│   │   │   │   ├── knowledge-base/ # Browse articles
│   │   │   │   ├── onboarding/  # Onboarding journey checklist
│   │   │   │   ├── profile/     # Ambassador profile
│   │   │   │   ├── schedule/    # Calendar view
│   │   │   │   ├── time/        # Time clock
│   │   │   │   └── page.tsx     # Ambassador dashboard
│   │   │   ├── coach/           # Coach pages
│   │   │   │   ├── ambassadors/ # Ambassador management
│   │   │   │   ├── business-excellence/ # CRM, website, outreach
│   │   │   │   ├── classes/     # Create and manage classes
│   │   │   │   ├── collaboration/ # Team discussions
│   │   │   │   ├── courses/     # Training courses
│   │   │   │   ├── crm/         # CRM contacts & deals
│   │   │   │   ├── events/      # Event viewing & RSVP
│   │   │   │   ├── income-goals/ # Income & goals tracking
│   │   │   │   ├── knowledge-base/ # Browse articles
│   │   │   │   ├── messages/    # Messaging with admin
│   │   │   │   ├── onboarding/  # Onboarding flow (profile, courses, quiz)
│   │   │   │   ├── projects/    # Project management
│   │   │   │   ├── resource-center/ # Resource center application
│   │   │   │   ├── schedule/    # Calendar
│   │   │   │   ├── sponsorship/ # Sponsorship requests
│   │   │   │   ├── time/        # Time tracking
│   │   │   │   └── page.tsx     # Coach dashboard
│   │   │   └── layout.tsx       # Dashboard layout with sidebar
│   │   ├── api/
│   │   │   ├── auth/            # NextAuth API routes
│   │   │   ├── ambassador/      # Ambassador API endpoints
│   │   │   └── coaches/         # Coach API endpoints
│   │   ├── layout.tsx           # Root layout
│   │   └── page.tsx             # Home redirect
│   ├── components/
│   │   ├── dashboard/           # Dashboard components
│   │   │   ├── header.tsx       # Header with user menu & impersonation
│   │   │   └── sidebar.tsx
│   │   ├── providers.tsx        # SessionProvider wrapper
│   │   └── ui/                  # Reusable UI components
│   │       ├── address-input.tsx  # Structured address fields
│   │       ├── badge.tsx
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── date-of-birth-input.tsx  # DOB with dropdowns
│   │       ├── dialog.tsx
│   │       ├── dropdown-menu.tsx
│   │       ├── input.tsx
│   │       ├── label.tsx
│   │       ├── password-input.tsx  # Password with generator
│   │       ├── phone-input.tsx     # Phone with country codes
│   │       ├── progress.tsx
│   │       ├── select.tsx
│   │       ├── switch.tsx
│   │       ├── table.tsx
│   │       ├── tabs.tsx
│   │       └── textarea.tsx
│   └── lib/
│       ├── actions/             # Server Actions
│       │   ├── ambassador-auth.ts # Ambassador account management
│       │   ├── ambassador-onboarding.ts # Ambassador onboarding progress
│       │   ├── impersonation.ts # Admin user impersonation
│       │   ├── ambassadors.ts   # Ambassador CRUD
│       │   ├── business-excellence.ts # CRM, website, outreach
│       │   ├── business-idea.ts # Business idea submission/review
│       │   ├── classes.ts       # Class management & enrollment
│       │   ├── coaches.ts       # Coach management
│       │   ├── collaboration.ts # Channels, posts, documents
│       │   ├── courses.ts       # Course & quiz management
│       │   ├── crm.ts           # CRM contacts, deals, activities
│       │   ├── events.ts        # Events & RSVP
│       │   ├── feature-config.ts # Feature toggles & access control
│       │   ├── income-goals.ts  # Goals & income tracking
│       │   ├── knowledge-base.ts # KB categories & articles
│       │   ├── messaging.ts     # Message threads
│       │   ├── onboarding.ts    # Onboarding progress
│       │   ├── projects.ts      # Projects, tasks, milestones
│       │   ├── resource-center.ts # Resource center apps
│       │   ├── scheduling.ts    # Calendar events
│       │   ├── sponsorship.ts   # Sponsorship requests
│       │   ├── time-clock.ts    # Time clock & entries
│       │   └── users.ts         # User management & permissions
│       ├── auth.ts              # NextAuth configuration
│       ├── feature-names.ts     # Feature key constants
│       ├── prisma.ts            # Prisma client singleton
│       └── utils.ts             # Utility functions (cn)
├── docker-compose.yml           # PostgreSQL container config
├── tailwind.config.ts           # Tailwind configuration
├── tsconfig.json                # TypeScript configuration
├── CLAUDE.md                    # AI assistant context
└── package.json                 # Dependencies and scripts
```

---

## Database Schema

### Core Entities

| Entity | Description |
|--------|-------------|
| **User** | Authentication accounts (Admin/Coach/Ambassador/Parent roles) |
| **CoachProfile** | Extended coach information and status |
| **Ambassador** | Youth participants (ages 10-24) with profile, photo, bio, social media links, address, and parent info |
| **AmbassadorOnboardingTask** | Ambassador onboarding steps configuration |
| **AmbassadorOnboardingProgress** | Ambassador progress on onboarding tasks |
| **BusinessIdea** | Ambassador business idea submissions |
| **CoachClass** | Classes offered by coaches |
| **ClassEnrollment** | Ambassador class enrollments |
| **OnboardingTask** | Configurable coach onboarding checklist items |
| **CoachOnboardingProgress** | Coach progress on onboarding tasks |
| **Course** | Training courses (video content) |
| **QuizQuestion/QuizAnswer** | Assessment questions and options |
| **QuizResult** | Coach quiz attempts and scores |
| **WeeklyGoal** | Coach weekly goals with targets |
| **IncomeEntry** | Income tracking entries |
| **BusinessExcellenceCRM** | CRM activation status |
| **WebsiteContentStatus** | Website readiness checklist |
| **OutreachActivityTarget/Log** | Marketing outreach tracking |
| **Event** | Organization events |
| **EventQualificationStatus** | Coach event qualification |
| **EventRSVP** | Event attendance responses |
| **SponsorshipRequest** | Funding/sponsorship requests |
| **ResourceCenter** | Resource center applications |
| **MessageThread/Message** | Coach-admin communication |
| **AuditLog** | System activity logging |

### Business Tools Entities

| Entity | Description |
|--------|-------------|
| **FeatureConfig** | Admin-configurable feature toggles per role |
| **UserFeaturePermission** | Per-user feature permission overrides (grant/deny) |
| **CRMPipelineStage** | Customizable sales pipeline stages |
| **CRMContact** | CRM contacts with company/job info |
| **CRMDeal** | Sales deals with value and probability |
| **CRMActivity** | CRM activities (calls, emails, meetings, tasks) |
| **Project** | Projects with status and date tracking |
| **Task** | Project tasks with priority and status |
| **ProjectMilestone** | Project milestones with due dates |
| **CollaborationChannel** | Discussion channels with role-based access |
| **ChannelPost** | Posts within collaboration channels |
| **ChannelPostReply** | Replies to channel posts |
| **ChannelMember** | Channel membership tracking |
| **SharedDocument** | Shared documents with role-based access |
| **TimeClockEntry** | Clock in/out entries for attendance |
| **TimeEntry** | Project-based time logging |
| **CalendarEvent** | Calendar events with recurrence support |
| **EventAttendee** | Event attendance with RSVP status |
| **KBCategory** | Knowledge base categories with hierarchy |
| **KBArticle** | Knowledge base articles with publishing workflow |

### Key Relationships

```
User (1) ─── (1) CoachProfile
User (1) ─── (1) Ambassador (optional, for ambassador login)
User (1) ─── (1) Ambassador (as parent, for parental monitoring)
CoachProfile (1) ─── (N) Ambassador
CoachProfile (1) ─── (N) CoachClass
CoachProfile (1) ─── (N) WeeklyGoal
CoachProfile (1) ─── (N) IncomeEntry
CoachProfile (1) ─── (N) SponsorshipRequest
CoachProfile (1) ─── (N) EventRSVP
CoachProfile (1) ─── (N) CoachOnboardingProgress
CoachProfile (N) ─── (1) CoachProfile (recruiter)
Ambassador (1) ─── (N) AmbassadorOnboardingProgress
Ambassador (1) ─── (1) BusinessIdea
Ambassador (1) ─── (N) ClassEnrollment
CoachClass (1) ─── (N) ClassEnrollment
Event (1) ─── (N) EventRSVP
Event (1) ─── (N) EventQualificationStatus
MessageThread (N) ─── (N) User (participants)
MessageThread (1) ─── (N) Message
```

---

## Authentication

### NextAuth.js Configuration

The application uses NextAuth.js v5 (beta) with a credentials provider:

- **Session Strategy:** JWT
- **Password Hashing:** bcryptjs
- **Role-Based Access:** Enforced via middleware and server-side checks

### Protected Routes

All `/admin/*`, `/coach/*`, and `/ambassador/*` routes are protected and require authentication. Role-based redirects ensure users can only access their designated areas.

### Session Structure

```typescript
interface Session {
  user: {
    id: string
    email: string
    role: 'ADMIN' | 'COACH' | 'AMBASSADOR' | 'PARENT'
    coachId?: string         // Only for COACH role
    ambassadorId?: string    // Only for AMBASSADOR or PARENT role
    isImpersonating?: boolean // True when admin is viewing as another user
    originalAdminId?: string  // Original admin ID when impersonating
  }
}
```

---

## User Roles

### Ambassador

**Capabilities:**
- Complete onboarding journey (interview, WhatsApp team, business idea, power team, classes)
- **Edit profile** with photo URL, bio, and social media links (Instagram, Facebook, Twitter/X, TikTok, LinkedIn, YouTube, website)
- Submit and edit business ideas for review
- Browse and enroll in classes (free and paid)
- View onboarding progress and status
- View assigned coach information

**Access:** `/ambassador/*` routes (login via `/ambassador-login`)

### Administrator

**Capabilities:**
- Manage coach accounts (create, edit, deactivate)
- Manage ambassador records
- **Create ambassador accounts** and assign to coaches
- **Impersonate users** - View the app as any coach or ambassador (via profile dropdown)
- Configure onboarding checklists
- Configure courses and quizzes
- Create and manage events
- Review sponsorship requests
- Review Resource Center applications
- View reports and exports
- Communicate with coaches

**Access:** `/admin/*` routes

### Coach

**Capabilities:**
- Complete onboarding checklist
- Manage assigned ambassadors
- Track Business Excellence metrics
- Set and track weekly goals
- Log income-generating activities
- View event qualifications and RSVP
- Submit sponsorship requests
- Message administrators

**Access:** `/coach/*` routes

---

## API Routes

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/callback/credentials` | Login with credentials |
| GET | `/api/auth/session` | Get current session |
| POST | `/api/auth/signout` | Sign out |

### Coaches

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/coaches/list` | List all coaches (Admin only) |

### Server Actions

The application primarily uses Next.js Server Actions for data mutations:

| Module | Actions |
|--------|---------|
| `ambassador-auth.ts` | createAmbassadorAccount, resetAmbassadorPassword, getAmbassadorProfile, updateAmbassadorProfile, getCoachesForAssignment |
| `impersonation.ts` | getUsersForImpersonation, getImpersonationData |
| `ambassador-onboarding.ts` | getAmbassadorOnboardingTasks, updateOnboardingProgress, approveInterview, markWhatsAppTeamCreated, inviteToPowerTeam |
| `ambassadors.ts` | createAmbassador, updateAmbassador, deleteAmbassador, updateAmbassadorStatus |
| `business-idea.ts` | saveBusinessIdea, submitBusinessIdea, reviewBusinessIdea, getBusinessIdeasForReview |
| `classes.ts` | createClass, updateClass, deleteClass, enrollInClass, withdrawFromClass, markAttendance |
| `coaches.ts` | createCoach, updateCoach, updateCoachUserStatus, resetCoachPassword |
| `courses.ts` | createCourse, updateCourse, deleteCourse, toggleCourseActive, addQuestion, updateQuestion, deleteQuestion |
| `events.ts` | createEvent, updateEvent, deleteEvent, submitRSVP |
| `income-goals.ts` | createWeeklyGoal, updateWeeklyGoal, createIncomeEntry, deleteIncomeEntry |
| `messaging.ts` | createMessageThread, replyToThread, markMessagesAsRead, updateThreadStatus |
| `onboarding.ts` | updateCoachProfile, uploadProfilePhoto, markCourseAsWatched, submitQuizAnswers |
| `resource-center.ts` | submitApplication, reviewApplication, addClass, updateClassAttendance, deleteClass |
| `sponsorship.ts` | createSponsorshipRequest, updateSponsorshipStatus, addAdminNotes |
| `business-excellence.ts` | toggleCRMActivation, updateWebsiteContent, setOutreachTarget, logOutreachActivity, deleteOutreachLog |
| `feature-config.ts` | isFeatureEnabled, getEnabledFeaturesForRole, getAllFeatureConfigs, updateFeatureConfig |
| `users.ts` | getAllUsers, createUser, updateUserRole, deleteUser, resetUserPassword, getUserFeaturePermissions, setUserFeaturePermission, setUserFeaturePermissions |
| `crm.ts` | CRM contacts, deals, pipeline stages, and activities CRUD |
| `projects.ts` | Projects, tasks, and milestones CRUD |
| `collaboration.ts` | getChannels, createChannel, updateChannel, deleteChannel, createPost, createReply, getSharedDocuments, createSharedDocument |
| `time-clock.ts` | clockIn, clockOut, getTimeClockEntries, createTimeEntry, getTimeEntries |
| `scheduling.ts` | Calendar events and attendee management |
| `knowledge-base.ts` | getKBCategories, getKBArticles, createKBArticle, updateKBArticle, publishKBArticle |

---

## Feature Documentation

### Ambassador Onboarding

Ambassadors (ages 10-24) complete a structured onboarding journey. For ambassadors under 18, parental consent is required and a parent/guardian account is automatically created:

1. **Interview** - Scheduled and approved by admin/director
2. **WhatsApp Support Team** - Created by admin after interview
3. **Business Idea Submission** - Ambassador submits idea for review
4. **Power Team Invitation** - Admin invites after business idea approval
5. **Class Enrollment** - Ambassador enrolls in at least one class

**Business Idea Workflow:**
1. Ambassador creates draft business idea
2. Ambassador submits for review
3. Admin reviews and approves, requests revision, or rejects
4. If revision needed, ambassador can edit and resubmit
5. Approved ideas unlock Power Team step

**Class System:**
- Coaches create classes (free or paid)
- Ambassadors browse and enroll
- Capacity limits supported
- Attendance tracking by coaches

### Coach Onboarding

Coaches complete a configurable checklist to become "Active":

1. Upload profile photo
2. Complete coach profile
3. Watch training courses
4. Pass course assessments (80% threshold)
5. Confirm workbook receipt
6. Have 2+ approved ambassadors

Progress is tracked with visual indicators and the coach status updates automatically when all requirements are met.

### Ambassador Management

- Coaches can add and manage their ambassadors
- Statuses: Pending, Approved, Inactive, Completed, On Hold
- Assessment tracking for each ambassador
- Admin can update statuses and manage all ambassadors

### Income & Goals Tracking

**Weekly Goals:**
- Set goals with title, target value, and date range
- Track progress with actual values
- Status: Pending, Completed, Partially Completed, Not Completed

**Income Entries:**
- Log income by date and activity type
- Activity types: Own Services, Teaching Classes, Fundraising, Other
- View monthly and weekly summaries

### Sponsorship Requests

**Request Types:**
- Coach Sponsorship (for the coach)
- Ambassador Sponsorship (for an ambassador)
- Project Funding (for community projects)

**Workflow:**
1. Coach submits request with amount, reason, urgency
2. Admin reviews in sponsorship queue
3. Admin approves (full/partial), sets payment plan, or declines
4. Coach sees decision and admin notes

### Events

**Admin Features:**
- Create events with name, dates, location
- Set qualification requirements (onboarding complete, X ambassadors)
- View RSVPs and qualified coaches

**Coach Features:**
- View upcoming and past events
- See qualification status and requirements
- Submit RSVP (Yes/No/Maybe) when qualified

### Messaging

**Coaches:**
- Create threads by category (Onboarding, Ambassadors, Sponsorship, Events, Technical, Other)
- View conversation history
- Reply to threads

**Admins:**
- View all message threads
- Filter by status and category
- Update thread status (Open, In Progress, Resolved)
- Reply to coaches

### Admin-Configurable Business Tools

The platform includes 6 configurable business tools that can be enabled/disabled per role:

| Feature | Description | Coach | Ambassador |
|---------|-------------|-------|------------|
| **CRM** | Contact management with deals pipeline | Full access | - |
| **Project Management** | Projects, tasks, milestones | Full access | - |
| **Collaboration** | Discussion channels and document sharing | Full access | Read/participate |
| **Time Clock** | Attendance clock in/out and time logging | Full access | Full access |
| **Scheduling** | Calendar events and meeting management | Full access | View/RSVP |
| **Knowledge Base** | Articles and documentation | Full access | Read-only |

**Feature Configuration:**
1. Admin navigates to Features page
2. Toggle features on/off globally
3. Enable/disable per role (Coach, Ambassador)
4. Per-user overrides via User Management

**Per-User Permissions:**
- Admin clicks on a user in User Management
- For each feature, select: Default (use role setting), Grant (always allow), or Deny (always block)
- User-specific permissions override role defaults

### User Management

Admins can create and manage user accounts:

1. Navigate to Admin → Users
2. Create new users with email, password, and role
3. Optionally set feature permissions during creation
4. Click on existing users to modify permissions
5. Reset passwords or delete accounts as needed

---

## Development

### Available Scripts

```bash
# Development
npm run dev          # Start dev server with hot reload

# Building
npm run build        # Create production build
npm start            # Start production server

# Database
npx prisma studio    # Open Prisma Studio GUI
npx prisma db push   # Push schema changes
npx prisma generate  # Regenerate Prisma Client
npx prisma db seed   # Seed database with demo data

# Linting
npm run lint         # Run ESLint
```

### Code Style

- **TypeScript:** Strict mode enabled
- **Components:** Functional components with hooks
- **Styling:** Tailwind CSS utility classes
- **State:** React useState/useEffect, Server Components where possible
- **Forms:** HTML forms with Server Actions
- **Validation:** Zod schemas

### UI Design

**Authentication Pages (Login, Forgot Password):**
- Modern glassmorphism design with backdrop blur
- Dark gradient background with animated floating orbs
- Staggered slide-up entrance animations
- Custom form inputs with icon prefixes and focus effects
- Gradient buttons with shimmer hover effects
- Password visibility toggle

**Animation Classes (in `globals.css`):**
- `animate-float` / `animate-float-delayed` - Floating motion for decorative elements
- `animate-pulse-glow` - Pulsating glow effect for background orbs
- `animate-slide-up` - Slide up entrance animation
- `animate-scale-in` - Scale entrance animation
- `animation-delay-*` - Staggered animation delays (100-500ms)
- `.glass` - Glassmorphism effect with backdrop blur

**Enhanced Form Components (`src/components/ui/`):**
- **PhoneInput** - Country selector with flags (47 countries), dial codes, and auto-formatting masks
- **PasswordInput** - Password generator button, strength meter (Weak/Fair/Good/Strong), requirements checklist
- **DateOfBirthInput** - Separate Month/Day/Year dropdowns with age calculation and validation
- **AddressInput** - Structured fields (Address 1 & 2, City, State/Province, Postal/ZIP, Country) with US/Canada state dropdowns

**Email Fields:**
- All email inputs use consistent placeholder: `name@example.com`
- Placeholder disappears on focus/typing (standard HTML behavior)

### Adding New Features

1. **Database changes:** Update `prisma/schema.prisma`, run `npx prisma db push`
2. **Server Actions:** Create in `src/lib/actions/`
3. **Pages:** Add to appropriate route in `src/app/(dashboard)/`
4. **Components:** Reusable UI in `src/components/ui/`

---

## Deployment

### Production Checklist

1. **Environment Variables:**
   - Set secure `NEXTAUTH_SECRET`
   - Configure production `DATABASE_URL`
   - Set `NEXTAUTH_URL` to production domain

2. **Database:**
   - Use managed PostgreSQL service (e.g., Supabase, Railway, AWS RDS)
   - Run migrations: `npx prisma migrate deploy`

3. **Build:**
   ```bash
   npm run build
   ```

4. **Hosting Options:**
   - Vercel (recommended for Next.js)
   - Railway
   - DigitalOcean App Platform
   - AWS/GCP with Docker

### Docker Deployment

A `Dockerfile` can be created for containerized deployment:

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
COPY --from=builder /app/next.config.mjs ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
```

---

## Support

For questions or issues:
- Review the [project requirements](./docs/project.txt)
- Check existing code patterns in similar features
- Use the in-app messaging system for coach support

---

## License

Proprietary - StageOneInAction

---

*Last updated: January 2026*

---

**Total Routes:** 40+ | **User Roles:** 3 (Admin, Coach, Ambassador) | **Build Status:** Passing
