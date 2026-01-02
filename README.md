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

**For Coaches:**
- Complete onboarding and compliance tracking
- Ambassador management
- Business Excellence tools (CRM, website readiness, marketing outreach)
- Weekly goals and income tracking
- Event qualification and RSVP
- Sponsorship requests
- Direct messaging with administrators

**For Administrators:**
- Coach and ambassador management
- Onboarding configuration
- Course and quiz management
- Event creation and qualification settings
- Sponsorship request review
- Resource Center application review
- Reporting and exports

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
| **Docker** | - | Database containerization |
| **Zod** | 3.x | Schema validation |
| **bcryptjs** | - | Password hashing |
| **Lucide React** | - | Icon library |

---

## Features

### Implemented Features

| Feature | Coach | Admin | Status |
|---------|-------|-------|--------|
| Authentication & Login | ✅ | ✅ | Complete |
| Dashboard | ✅ | ✅ | Complete |
| Onboarding Checklist | ✅ | - | Complete |
| Profile Management | ✅ | ✅ | Complete |
| Ambassador Management | ✅ | ✅ | Complete |
| Income & Goals Tracking | ✅ | - | Complete |
| Sponsorship Requests | ✅ | ✅ | Complete |
| Messaging System | ✅ | ✅ | Complete |
| Events & RSVP | ✅ | ✅ | Complete |
| Coach Management | - | ✅ | Complete |
| Business Excellence | ✅ | - | Complete |
| Resource Center | ✅ | ✅ | Complete |
| Training Courses | ✅ | ✅ | Complete |
| Reports & Analytics | - | ✅ | Complete |

### Future Enhancements

- Audit Logs
- Admin Settings
- Email Notifications

---

## Getting Started

### Prerequisites

- **Node.js** 18.x or higher
- **npm** or **yarn**
- **Docker** and **Docker Compose** (for PostgreSQL)
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

4. **View the database (optional):**
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

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@stageoneinaction.com | admin123 |
| Coach | coach@stageoneinaction.com | coach123 |

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
│   │   ├── (dashboard)/         # Dashboard routes (protected)
│   │   │   ├── admin/           # Admin pages
│   │   │   │   ├── ambassadors/ # Ambassador management
│   │   │   │   ├── coaches/     # Coach management (list, detail, new)
│   │   │   │   ├── courses/     # Course & quiz configuration
│   │   │   │   ├── events/      # Event management
│   │   │   │   ├── messages/    # Message threads
│   │   │   │   ├── reports/     # Reports & analytics
│   │   │   │   ├── resource-centers/ # Resource center applications
│   │   │   │   ├── sponsorship/ # Sponsorship review
│   │   │   │   └── page.tsx     # Admin dashboard
│   │   │   ├── coach/           # Coach pages
│   │   │   │   ├── ambassadors/ # Ambassador management
│   │   │   │   ├── business-excellence/ # CRM, website, outreach
│   │   │   │   ├── courses/     # Training courses
│   │   │   │   ├── events/      # Event viewing & RSVP
│   │   │   │   ├── income-goals/ # Income & goals tracking
│   │   │   │   ├── messages/    # Messaging with admin
│   │   │   │   ├── onboarding/  # Onboarding flow (profile, courses, quiz)
│   │   │   │   ├── resource-center/ # Resource center application
│   │   │   │   ├── sponsorship/ # Sponsorship requests
│   │   │   │   └── page.tsx     # Coach dashboard
│   │   │   └── layout.tsx       # Dashboard layout with sidebar
│   │   ├── api/
│   │   │   ├── auth/            # NextAuth API routes
│   │   │   └── coaches/         # Coach API endpoints
│   │   ├── login/               # Login page
│   │   ├── forgot-password/     # Password reset page
│   │   ├── layout.tsx           # Root layout
│   │   └── page.tsx             # Home redirect
│   ├── components/
│   │   ├── dashboard/           # Dashboard components
│   │   │   ├── header.tsx
│   │   │   └── sidebar.tsx
│   │   └── ui/                  # Reusable UI components
│   │       ├── badge.tsx
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── input.tsx
│   │       └── progress.tsx
│   └── lib/
│       ├── actions/             # Server Actions
│       │   ├── ambassadors.ts   # Ambassador CRUD
│       │   ├── business-excellence.ts # CRM, website, outreach
│       │   ├── coaches.ts       # Coach management
│       │   ├── courses.ts       # Course & quiz management
│       │   ├── events.ts        # Events & RSVP
│       │   ├── income-goals.ts  # Goals & income tracking
│       │   ├── messaging.ts     # Message threads
│       │   ├── onboarding.ts    # Onboarding progress
│       │   ├── resource-center.ts # Resource center apps
│       │   └── sponsorship.ts   # Sponsorship requests
│       ├── auth.ts              # NextAuth configuration
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
| **User** | Authentication accounts (Admin/Coach roles) |
| **CoachProfile** | Extended coach information and status |
| **Ambassador** | Youth participants managed by coaches |
| **OnboardingTask** | Configurable onboarding checklist items |
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

### Key Relationships

```
User (1) ─── (1) CoachProfile
CoachProfile (1) ─── (N) Ambassador
CoachProfile (1) ─── (N) WeeklyGoal
CoachProfile (1) ─── (N) IncomeEntry
CoachProfile (1) ─── (N) SponsorshipRequest
CoachProfile (1) ─── (N) EventRSVP
CoachProfile (1) ─── (N) CoachOnboardingProgress
CoachProfile (N) ─── (1) CoachProfile (recruiter)
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

All `/admin/*` and `/coach/*` routes are protected and require authentication. Role-based redirects ensure users can only access their designated areas.

### Session Structure

```typescript
interface Session {
  user: {
    id: string
    email: string
    role: 'ADMIN' | 'COACH'
    coachId?: string  // Only for COACH role
  }
}
```

---

## User Roles

### Administrator

**Capabilities:**
- Manage coach accounts (create, edit, deactivate)
- Manage ambassador records
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
| `onboarding.ts` | updateCoachProfile, uploadProfilePhoto, markCourseAsWatched, submitQuizAnswers |
| `ambassadors.ts` | createAmbassador, updateAmbassador, deleteAmbassador, updateAmbassadorStatus |
| `coaches.ts` | createCoach, updateCoach, updateCoachUserStatus, resetCoachPassword |
| `income-goals.ts` | createWeeklyGoal, updateWeeklyGoal, createIncomeEntry, deleteIncomeEntry |
| `sponsorship.ts` | createSponsorshipRequest, updateSponsorshipStatus, addAdminNotes |
| `messaging.ts` | createMessageThread, replyToThread, markMessagesAsRead, updateThreadStatus |
| `events.ts` | createEvent, updateEvent, deleteEvent, submitRSVP |
| `resource-center.ts` | submitApplication, reviewApplication, addClass, updateClassAttendance, deleteClass |
| `courses.ts` | createCourse, updateCourse, deleteCourse, toggleCourseActive, addQuestion, updateQuestion, deleteQuestion |
| `business-excellence.ts` | toggleCRMActivation, updateWebsiteContent, setOutreachTarget, logOutreachActivity, deleteOutreachLog |

---

## Feature Documentation

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

*Last updated: December 2024*

---

**Total Routes:** 31 | **Build Status:** Passing
