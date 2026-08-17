# NowTransformed Back Office - Project Plan

**Document Version:** 1.1
**Created:** January 26, 2026
**Last Updated:** January 26, 2026

---

## Executive Summary

The NowTransformed Back Office is a comprehensive Next.js 14 enterprise application managing coaches, ambassadors, and prospects through a complete onboarding and business management platform. This project plan outlines the roadmap from current state to production-ready deployment and beyond.

### Current State Metrics

| Metric | Value |
|--------|-------|
| Codebase | Next.js 14.2.35 + TypeScript 5.9.3 |
| Database | PostgreSQL + Prisma (77 models) |
| Pages | 93 (Admin: 36, Coach: 29, Ambassador: 16) |
| Server Actions | 302 functions across 32 files |
| Test Coverage | 0% |
| Production Ready | No (missing critical integrations) |

### Project Goals

1. **Production Readiness** - Deploy a stable, secure, monitored application
2. **Feature Completion** - Complete partially implemented features
3. **Integration** - Connect external services (email, file storage, payments)
4. **Quality** - Establish testing and monitoring practices
5. **Scalability** - Prepare architecture for growth

---

## Application Overview

### User Roles

| Role | Description | Page Count |
|------|-------------|------------|
| **ADMIN** | System administrators with full access | 36 pages |
| **COACH** | Adult coaches managing ambassadors, business tools | 29 pages |
| **AMBASSADOR** | Youth members ages 10-24, learning & profile | 16 pages |
| **PARENT** | Guardian of under-18 ambassador, read-only access | Limited |

### Feature Matrix by Role

#### Admin Features
- **User Management** - Create/edit users, impersonate any user, per-user permissions
- **Prospect Pipeline** - 14-step workflow from assessment to account creation
- **Content Management** - LMS courses, surveys, quizzes, knowledge base
- **Onboarding Config** - Configure coach and ambassador onboarding tasks
- **Business Tools Admin** - Feature toggles, CRM config, event management
- **System** - Audit logs, calendars, notifications, reports

#### Coach Features
- **Ambassador Management** - Create accounts (with parental consent for under-18), track progress
- **Business Tools** - CRM (contacts, deals, pipeline), Project Management, Income Tracking, Weekly Goals
- **Content** - Create classes, complete LMS courses, browse knowledge base
- **Communication** - Collaboration channels, direct messages, @mentions, emoji reactions
- **Operations** - Time clock, calendar, events, sponsorship requests

#### Ambassador Features
- **Profile** - Photo, bio, social links, address, parent info (if under 18)
- **Onboarding** - Visual progress tracker, task completion
- **Learning** - LMS courses, surveys, quizzes, knowledge base
- **Business** - Business idea submission with review workflow
- **Tools** - Time clock, collaboration, calendar, events

#### Parent Features
- View child's profile (read-only)
- Monitor onboarding progress
- View activities

### Core Systems

| System | Description |
|--------|-------------|
| **Authentication** | Email/password, role-based access, admin impersonation, JWT sessions |
| **Prospect Pipeline** | 14-step workflow: Assessment → Orientation → Interview → Payment → Account |
| **LMS** | Courses → Modules → Lessons → Content Blocks (VIDEO, TEXT, QUIZ, DOCUMENT) |
| **Collaboration** | Slack-like channels, DMs, threads, @mentions, 13 emoji reactions, file sharing |
| **Calendar & Booking** | Recurring slots, public booking links, real-time SSE updates |
| **CRM** | Pipeline stages, contacts, deals, activities |
| **Surveys** | Multi-page, 5 question types, public assessment links, preview mode |

### Toggleable Feature Modules (6)

| Feature | Coach Default | Ambassador Default |
|---------|---------------|-------------------|
| CRM | Enabled | Disabled |
| Project Management | Enabled | Disabled |
| Collaboration | Enabled | Enabled |
| Time Clock | Enabled | Enabled |
| Scheduling | Enabled | Enabled |
| Knowledge Base | Enabled | Enabled |

### Public Pages (No Login Required)

| Route | Purpose |
|-------|---------|
| `/assessment/[surveyId]` | Prospect coach assessment survey |
| `/business-form/[token]` | Prospect business development form |
| `/acceptance/[token]` | Acceptance letter + payment |
| `/book/[slug]` | Public calendar booking |
| `/book/orientation/[token]` | Prospect orientation booking |

### Database Summary

| Category | Model Count |
|----------|-------------|
| Auth & Users | 4 |
| Onboarding | 6 |
| Learning (LMS + Legacy) | 18 |
| Business Tools | 16 |
| Communication | 13 |
| Events & Scheduling | 11 |
| Financial | 4 |
| System | 7 |
| **Total** | **77 models** |

---

## Feature Analysis & Business Logic Review

This section documents each feature's current implementation status, business logic questions, and verification status. Features are reviewed one-by-one to ensure they work correctly according to business requirements.

**Review Status Legend:**
- ⏳ **Pending Review** - Not yet analyzed
- 🔍 **In Review** - Currently being analyzed
- ❓ **Needs Clarification** - Business logic questions pending
- ✅ **Verified Working** - Tested and confirmed working
- ⚠️ **Partially Working** - Some functionality works, issues identified
- ❌ **Not Working** - Critical issues identified

---

### Feature 1: Authentication

**Status:** ❓ Needs Clarification
**Last Reviewed:** 2026-01-26

#### Current Implementation

| Component | Status | Notes |
|-----------|--------|-------|
| Email/password login | ✅ Implemented | NextAuth v5 credentials provider |
| JWT sessions | ✅ Implemented | Token-based authentication |
| User roles | ✅ Implemented | ADMIN, COACH, AMBASSADOR, PARENT |
| Login page (`/login`) | ✅ Implemented | Admin/Coach login |
| Ambassador login (`/ambassador-login`) | ✅ Implemented | Separate portal |
| Admin impersonation | ✅ Implemented | Session switching with `isImpersonating` flag |
| User status check | ✅ Implemented | Only ACTIVE users can log in |
| Forgot password page | ⚠️ UI Only | Link exists, email sending NOT implemented |

#### Technical Details

**Files:**
- `src/lib/auth.ts` - NextAuth configuration
- `src/app/(auth)/login/page.tsx` - Admin/Coach login page
- `src/app/(auth)/ambassador-login/page.tsx` - Ambassador login page
- `src/app/(auth)/forgot-password/page.tsx` - Password reset request page

**Session Data:**
```typescript
session.user = {
  id: string,
  email: string,
  role: UserRole,  // ADMIN | COACH | AMBASSADOR | PARENT
  ambassadorId?: string,
  coachId?: string,
  isImpersonating?: boolean,
  originalAdminId?: string
}
```

**Post-Login Redirects:**
- Admin/Coach → `/` (dashboard)
- Ambassador → `/ambassador`

#### Business Logic Questions (PENDING ANSWERS)

1. **Post-login flow per role:**
   - What should happen after login for each role?
   - Is there a specific landing page per role?
   - Should there be onboarding checks (incomplete profile, etc.)?

2. **Registration flow:**
   - Is there a self-registration flow? Or only admin-created accounts?
   - If self-registration exists, what validation is required?

3. **Password reset:**
   - What is the expected password reset flow?
   - What email should be sent?
   - Token expiration time?

4. **Session management:**
   - What is the expected session timeout?
   - Should sessions persist across browser restarts?
   - Should there be "remember me" functionality?

5. **Additional validation:**
   - Is email verification required?
   - Should there be account lockout after failed attempts?
   - Are there any IP-based restrictions?

6. **Ambassador vs Main login:**
   - Should ambassadors ONLY use `/ambassador-login`?
   - What happens if an ambassador logs in via `/login`?
   - Is the separate login page required?

7. **Parent role:**
   - How do parents log in?
   - What access do they have after login?
   - Is there a dedicated parent portal?

#### Known Issues

1. **Password reset email not implemented** - Forgot password page exists but no email is sent
2. **No email verification** - Users are active immediately without email confirmation

---

### Feature 2: User Management

**Status:** ⏳ Pending Review

---

### Feature 3: Admin Impersonation

**Status:** ⏳ Pending Review

---

### Feature 4: Coach Profiles

**Status:** ⏳ Pending Review

---

### Feature 5: Ambassador Profiles

**Status:** ⏳ Pending Review

---

### Feature 6: Prospect Pipeline (14 Steps)

**Status:** ⏳ Pending Review

---

### Feature 7: LMS (Learning Management System)

**Status:** ⏳ Pending Review

---

### Feature 8: Collaboration (Channels, DMs, Threads)

**Status:** ⏳ Pending Review

---

### Feature 9: Time Clock

**Status:** ⏳ Pending Review

---

### Feature 10: Calendar & Booking

**Status:** ⏳ Pending Review

---

### Feature 11: Surveys & Quizzes

**Status:** ⏳ Pending Review

---

### Feature 12: Knowledge Base

**Status:** ⏳ Pending Review

---

### Feature 13: Events

**Status:** ⏳ Pending Review

---

### Feature 14: Sponsorship

**Status:** ⏳ Pending Review

---

### Feature 15: Business Ideas

**Status:** ⏳ Pending Review

---

### Feature 16: Onboarding

**Status:** ⏳ Pending Review

---

### Feature 17: Income & Goals

**Status:** ⏳ Pending Review

---

### Feature 18: Resource Centers

**Status:** ⏳ Pending Review

---

### Feature 19: Classes

**Status:** ⏳ Pending Review

---

### Feature 20: Feature Configuration

**Status:** ⏳ Pending Review

---

### Feature 21: Audit Logging

**Status:** ⏳ Pending Review

---

### Feature 22: CRM

**Status:** ⏳ Pending Review

---

### Feature 23: Project Management

**Status:** ⏳ Pending Review

---

### Feature 24: Business Excellence

**Status:** ⏳ Pending Review

---

## Phase 1: Production Foundation

**Duration:** 4-6 weeks
**Priority:** Critical
**Goal:** Minimum viable production deployment

### 1.1 Testing Infrastructure

| Task | Description | Estimate | Priority |
|------|-------------|----------|----------|
| Set up Jest + React Testing Library | Configure testing framework | 4 hours | High |
| Create test utilities | Auth mocks, Prisma mocks, test helpers | 8 hours | High |
| Unit tests: Authentication | Test login, session, impersonation | 16 hours | High |
| Unit tests: Prospect Pipeline | Test 14-step pipeline actions | 24 hours | High |
| Unit tests: Booking System | Test calendar, slots, bookings | 16 hours | High |
| Unit tests: LMS | Test enrollment, progress tracking | 16 hours | Medium |
| Integration tests: Critical flows | End-to-end user journeys | 24 hours | High |
| CI/CD pipeline | GitHub Actions for test automation | 8 hours | High |

**Subtotal:** 116 hours (~3 weeks)

### 1.2 Email Service Integration

| Task | Description | Estimate | Priority |
|------|-------------|----------|----------|
| Select email provider | Evaluate SendGrid vs Mailgun vs AWS SES | 4 hours | High |
| Create email service module | `src/lib/email.ts` with provider abstraction | 8 hours | High |
| Email templates | HTML templates with Tailwind styling | 16 hours | High |
| Password reset flow | Complete forgot-password implementation | 8 hours | High |
| Welcome emails | New user registration emails | 4 hours | Medium |
| Prospect notifications | Assessment received, status changes | 8 hours | Medium |
| Booking confirmations | Calendar booking emails | 4 hours | Medium |
| Admin notifications | Email alerts for admin events | 4 hours | Low |

**Email Templates Required:**
- `password-reset.html` - Password reset link
- `welcome-user.html` - New account welcome
- `welcome-ambassador.html` - Ambassador-specific welcome
- `prospect-assessment-received.html` - Admin notification
- `prospect-status-change.html` - Prospect pipeline updates
- `booking-confirmation.html` - Calendar booking confirmation
- `booking-reminder.html` - 24-hour booking reminder

**Subtotal:** 56 hours (~1.5 weeks)

### 1.3 Error Tracking & Monitoring

| Task | Description | Estimate | Priority |
|------|-------------|----------|----------|
| Sentry integration | Install and configure Sentry | 4 hours | High |
| Error boundaries | Add React error boundaries to pages | 8 hours | High |
| Structured logging | Replace console.error with logger | 8 hours | Medium |
| Health check endpoint | `/api/health` for monitoring | 2 hours | Medium |
| Performance monitoring | Core Web Vitals tracking | 4 hours | Low |

**Subtotal:** 26 hours (~1 week)

### 1.4 Security Hardening

| Task | Description | Estimate | Priority |
|------|-------------|----------|----------|
| Security audit | OWASP Top 10 review | 8 hours | High |
| Rate limiting | Add rate limits to API routes | 8 hours | High |
| Input sanitization audit | Review all form inputs | 8 hours | High |
| CORS configuration | Verify CORS settings | 2 hours | Medium |
| CSP headers | Content Security Policy | 4 hours | Medium |
| Dependency audit | Check for vulnerable packages | 2 hours | High |

**Subtotal:** 32 hours (~1 week)

### Phase 1 Total: 230 hours (~6 weeks)

---

## Phase 2: Feature Completion

**Duration:** 4-6 weeks
**Priority:** High
**Goal:** Complete all partially implemented features

### 2.1 File Upload Service

| Task | Description | Estimate | Priority |
|------|-------------|----------|----------|
| Select storage provider | AWS S3 vs Google Cloud Storage vs Cloudinary | 4 hours | High |
| Create upload service | `src/lib/storage.ts` with provider abstraction | 8 hours | High |
| Upload API routes | `/api/upload` with file validation | 8 hours | High |
| Profile photo upload | Ambassador/Coach photo management | 8 hours | High |
| Document upload | Shared documents in collaboration | 8 hours | Medium |
| Onboarding file upload | Task completion attachments | 4 hours | Medium |
| File size/type validation | Security constraints | 4 hours | High |
| Signed URLs | Secure file access | 4 hours | Medium |

**Subtotal:** 48 hours (~1.5 weeks)

### 2.2 Payment Integration Completion

| Task | Description | Estimate | Priority |
|------|-------------|----------|----------|
| Stripe integration | Complete Stripe checkout flow | 16 hours | High |
| PayPal integration | Complete PayPal checkout flow | 16 hours | Medium |
| Payment webhooks | Handle payment status updates | 8 hours | High |
| Receipt generation | PDF receipts for payments | 8 hours | Medium |
| Refund handling | Admin refund functionality | 4 hours | Low |

**Subtotal:** 52 hours (~1.5 weeks)

### 2.3 Notification System

| Task | Description | Estimate | Priority |
|------|-------------|----------|----------|
| Push notification service | Firebase Cloud Messaging or OneSignal | 8 hours | Medium |
| Browser push notifications | Service worker setup | 8 hours | Medium |
| Notification preferences | User notification settings | 8 hours | Medium |
| Real-time notifications | WebSocket for instant alerts | 8 hours | Low |
| SMS notifications (optional) | Twilio integration | 8 hours | Low |

**Subtotal:** 40 hours (~1 week)

### 2.4 WhatsApp Integration

| Task | Description | Estimate | Priority |
|------|-------------|----------|----------|
| WhatsApp Business API setup | Meta Business account configuration | 8 hours | Medium |
| Message templates | Create approved templates | 4 hours | Medium |
| Ambassador group links | Auto-generate group invite links | 8 hours | Medium |
| Support team messaging | Direct messaging to support | 8 hours | Low |

**Subtotal:** 28 hours (~1 week)

### 2.5 Reporting & Analytics

| Task | Description | Estimate | Priority |
|------|-------------|----------|----------|
| Report builder framework | Reusable report components | 16 hours | Medium |
| Ambassador analytics | Onboarding completion, activity metrics | 8 hours | Medium |
| Coach analytics | Income, goals, ambassador performance | 8 hours | Medium |
| Prospect pipeline analytics | Conversion rates, bottlenecks | 8 hours | High |
| Export functionality | CSV/Excel export for reports | 8 hours | Medium |
| Dashboard widgets | Summary statistics cards | 8 hours | Medium |

**Subtotal:** 56 hours (~1.5 weeks)

### Phase 2 Total: 224 hours (~6 weeks)

---

## Phase 3: Enhancement & Optimization

**Duration:** 4-6 weeks
**Priority:** Medium
**Goal:** Optimize performance and add advanced features

### 3.1 Calendar Integrations

| Task | Description | Estimate | Priority |
|------|-------------|----------|----------|
| Google Calendar sync | OAuth + Calendar API | 16 hours | Medium |
| Outlook Calendar sync | Microsoft Graph API | 16 hours | Medium |
| iCal export | Export events as .ics files | 4 hours | Low |
| Two-way sync | Bidirectional calendar updates | 16 hours | Low |

**Subtotal:** 52 hours (~1.5 weeks)

### 3.2 Performance Optimization

| Task | Description | Estimate | Priority |
|------|-------------|----------|----------|
| Redis caching | Cache frequently accessed data | 16 hours | Medium |
| Database query optimization | Analyze and optimize slow queries | 16 hours | Medium |
| Image optimization | Next.js Image component, CDN | 8 hours | Medium |
| Code splitting | Optimize bundle sizes | 8 hours | Low |
| API response caching | Cache API responses | 8 hours | Low |

**Subtotal:** 56 hours (~1.5 weeks)

### 3.3 Advanced Features

| Task | Description | Estimate | Priority |
|------|-------------|----------|----------|
| Power Team assignment | Complete ambassador team feature | 16 hours | Medium |
| Bulk operations | Bulk email, status updates | 12 hours | Medium |
| Advanced search | Full-text search across entities | 16 hours | Low |
| Audit log reporting | Export and filter audit logs | 8 hours | Low |
| System settings expansion | Complete admin settings | 12 hours | Low |

**Subtotal:** 64 hours (~1.5 weeks)

### 3.4 Documentation

| Task | Description | Estimate | Priority |
|------|-------------|----------|----------|
| API documentation | Document all server actions | 16 hours | Medium |
| User guides | Admin, Coach, Ambassador guides | 24 hours | Medium |
| Developer documentation | Setup, architecture, patterns | 16 hours | Medium |
| Component storybook | UI component documentation | 16 hours | Low |

**Subtotal:** 72 hours (~2 weeks)

### Phase 3 Total: 244 hours (~6 weeks)

---

## Phase 4: Future Roadmap

**Duration:** Ongoing
**Priority:** Low
**Goal:** Long-term platform evolution

### 4.1 Mobile Application

| Task | Description | Estimate |
|------|-------------|----------|
| Mobile app evaluation | React Native vs Flutter vs PWA | 8 hours |
| Core mobile features | Authentication, profile, dashboard | 120 hours |
| Push notifications | Mobile push integration | 16 hours |
| Offline support | Offline-first architecture | 40 hours |

**Subtotal:** 184 hours (~5 weeks)

### 4.2 Advanced Integrations

| Task | Description | Estimate |
|------|-------------|----------|
| Zoom API | Auto-create meetings | 24 hours |
| Google Meet API | Auto-create meetings | 24 hours |
| Zapier integration | Webhook-based automation | 24 hours |
| CRM integrations | Salesforce, HubSpot connectors | 40 hours |

**Subtotal:** 112 hours (~3 weeks)

### 4.3 Platform Scaling

| Task | Description | Estimate |
|------|-------------|----------|
| Multi-tenancy | Support multiple organizations | 80 hours |
| API versioning | Public API with versioning | 40 hours |
| Background job queue | Bull/BullMQ for async tasks | 24 hours |
| Database sharding | Horizontal scaling strategy | 40 hours |

**Subtotal:** 184 hours (~5 weeks)

---

## Resource Requirements

### Development Team

| Role | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
|------|---------|---------|---------|---------|
| Full-Stack Developer | 1 | 1 | 1 | 1-2 |
| QA Engineer | 0.5 | 0.5 | 0.5 | 0.5 |
| DevOps Engineer | 0.25 | 0.25 | 0.5 | 0.5 |
| UI/UX Designer | 0 | 0.25 | 0.25 | 0.5 |

### Infrastructure Costs (Monthly Estimates)

| Service | Phase 1-2 | Phase 3+ |
|---------|-----------|----------|
| Vercel Pro (hosting) | $20 | $20 |
| PostgreSQL (managed) | $25-50 | $50-100 |
| Redis (caching) | $0 | $15-30 |
| SendGrid (email) | $15-20 | $20-50 |
| AWS S3 (storage) | $5-10 | $20-50 |
| Sentry (monitoring) | $26 | $26 |
| **Total** | **$91-126** | **$151-276** |

### Third-Party Services

| Service | Purpose | Cost |
|---------|---------|------|
| SendGrid | Email delivery | $14.95/mo (40k emails) |
| AWS S3 | File storage | ~$0.023/GB |
| Sentry | Error tracking | $26/mo (Team plan) |
| Stripe | Payments | 2.9% + $0.30/transaction |
| PayPal | Payments | 2.9% + $0.30/transaction |
| Twilio (optional) | SMS | $0.0079/message |

---

## Risk Assessment

### High Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| No test coverage | Bugs in production | Phase 1 priority: 60%+ coverage |
| Email not integrated | Users can't reset passwords | Phase 1 priority: email service |
| No error tracking | Silent failures | Phase 1 priority: Sentry |

### Medium Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| File upload missing | Limited functionality | Phase 2: S3 integration |
| Payment incomplete | Revenue impact | Phase 2: Complete Stripe/PayPal |
| No caching | Performance issues | Phase 3: Redis caching |

### Low Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| No calendar sync | Manual entry required | Phase 3: Google/Outlook |
| Limited reporting | Manual analysis | Phase 2: Report builder |
| No mobile app | Desktop-only users | Phase 4: Mobile development |

---

## Success Metrics

### Phase 1 Completion Criteria

- [ ] Test coverage > 60% on critical paths
- [ ] Email service operational (password reset working)
- [ ] Sentry capturing errors
- [ ] Security audit passed
- [ ] CI/CD pipeline running

### Phase 2 Completion Criteria

- [ ] File uploads working (profile photos, documents)
- [ ] Payment flow complete (Stripe checkout)
- [ ] Reporting dashboard functional
- [ ] All TODO comments resolved

### Phase 3 Completion Criteria

- [ ] Google Calendar sync working
- [ ] Page load times < 2 seconds
- [ ] Redis caching operational
- [ ] Documentation complete

### Key Performance Indicators (KPIs)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Uptime | 99.9% | Monitoring dashboard |
| Error rate | < 0.1% | Sentry metrics |
| Page load time | < 2s | Core Web Vitals |
| Test coverage | > 60% | Jest coverage report |
| API response time | < 500ms | APM monitoring |

---

## Timeline Summary

```
Week 1-2:   Testing infrastructure + CI/CD
Week 3-4:   Email integration + Password reset
Week 5-6:   Security hardening + Error tracking
            --- PHASE 1 COMPLETE: Production Ready ---

Week 7-8:   File upload service
Week 9-10:  Payment integration completion
Week 11-12: Notification system + Reporting
            --- PHASE 2 COMPLETE: Feature Complete ---

Week 13-14: Calendar integrations
Week 15-16: Performance optimization
Week 17-18: Documentation + Polish
            --- PHASE 3 COMPLETE: Optimized ---

Week 19+:   Mobile app + Advanced features
            --- PHASE 4: Ongoing Enhancements ---
```

---

## Immediate Next Steps

### This Week

1. **Set up Jest testing framework**
   - Install dependencies: `npm install -D jest @testing-library/react @testing-library/jest-dom`
   - Create `jest.config.js` and test setup files
   - Write first authentication tests

2. **Select and configure email provider**
   - Recommend: SendGrid (best Next.js integration)
   - Create account and verify domain
   - Set up environment variables

3. **Install Sentry**
   - `npm install @sentry/nextjs`
   - Configure error boundaries
   - Test error capture

### Next Week

4. **Complete password reset flow**
   - Implement email sending
   - Create reset token system
   - Build reset password page

5. **Begin critical path testing**
   - Authentication flow tests
   - Prospect pipeline tests
   - Booking system tests

---

## Appendix A: Environment Variables Required

```env
# Database
DATABASE_URL="postgresql://..."

# Authentication
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="https://app.stageoneinaction.com"

# Email (Phase 1)
SENDGRID_API_KEY="..."
EMAIL_FROM="noreply@stageoneinaction.com"

# File Storage (Phase 2)
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
AWS_S3_BUCKET="..."
AWS_REGION="us-east-1"

# Payments (Phase 2)
STRIPE_SECRET_KEY="..."
STRIPE_WEBHOOK_SECRET="..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="..."
PAYPAL_CLIENT_ID="..."
PAYPAL_CLIENT_SECRET="..."

# Monitoring (Phase 1)
SENTRY_DSN="..."
NEXT_PUBLIC_SENTRY_DSN="..."

# Application
COACH_PROGRAM_FEE="1500"
NEXT_PUBLIC_COACH_PROGRAM_FEE="1500"
MIGRATION_SECRET="..."
```

---

## Appendix B: Technology Decisions

### Recommended Providers

| Service | Recommended | Alternatives |
|---------|-------------|--------------|
| Email | SendGrid | Mailgun, AWS SES |
| File Storage | AWS S3 | Google Cloud Storage, Cloudinary |
| Error Tracking | Sentry | LogRocket, Bugsnag |
| Caching | Redis (Upstash) | Vercel KV |
| Payments | Stripe | Already selected |
| Push Notifications | Firebase FCM | OneSignal |

### Rationale

- **SendGrid**: Best Next.js integration, good free tier, reliable deliverability
- **AWS S3**: Industry standard, cost-effective, excellent SDK
- **Sentry**: Best-in-class error tracking, Next.js plugin available
- **Upstash Redis**: Serverless Redis, perfect for Vercel deployment

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-26 | Claude | Initial project plan |
| 1.1 | 2026-01-26 | Claude | Added Feature Analysis section with 24 features to review; Documented Authentication feature implementation and business logic questions |

---

*This document should be reviewed and updated at the start of each phase.*
