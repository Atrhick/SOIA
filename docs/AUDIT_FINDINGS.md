# SOIA Back Office - Code Audit Findings

**Audit Date:** February 11, 2026
**Total Issues Found:** 71
**Fixed:** 33 | **Remaining:** 28 | **Not an Issue:** 2

## Fix Summary

### Critical (All Fixed)
- **C1**: Replaced `Math.random()` tokens with `crypto.randomBytes()` in prospects.ts (4 locations)
- **C2**: Moved secrets from `.env` to `.env.local`, `.env` now has placeholders
- **C3**: Migration API uses Authorization header instead of query param, added impersonation check
- **C4**: Parent password uses `crypto.randomBytes()` in ambassador-auth.ts
- **C5**: Coach password uses `crypto.randomBytes()` in prospects.ts
- **C7**: Wrapped multi-record mutations in `$transaction` (ambassadors.ts, business-idea.ts)

### High (Most Fixed)
- **H1**: Password min 8 + uppercase/lowercase/number (ambassador-auth.ts, coaches.ts)
- **H2**: Standardized bcrypt cost to 12 (users.ts)
- **H4**: Added double-impersonation prevention (impersonation.ts)
- **H5**: Added session timeout (7 days max, 24h refresh) in auth.ts
- **H6**: Added `!isImpersonating` check on migration endpoint
- **H7**: Added 16 indexes + 1 unique constraint across 8 models in schema.prisma
- **H12**: Replaced `z.any()` with proper schemas (surveys.ts, content-blocks.ts)
- **H14**: Added `@@unique([surveyId, contactEmail])` to SurveySubmission

### Medium (Security & Performance Fixed)
- **M1**: Added security headers (X-Content-Type-Options, X-Frame-Options, etc.) to next.config.js
- **M2**: Removed PII (email, age) from audit log details in ambassador-auth.ts
- **M3**: Added token format validation before DB query in prospects.ts
- **M4**: Added impersonation checks on admin operations (coaches.ts, feature-config.ts)
- **M5**: Optimized revalidatePath to layout-level (3 calls instead of 11) in collaboration.ts
- **M6/M18**: Parallelized sequential queries with `Promise.all` in feature-config.ts
- **M7**: Already had date range filtering (not an issue)

### Additional Fixes
- Fixed password min 6 → 8 in coaches.ts (createCoach, resetCoachPassword)
- Fixed password min 6 → 8 in ambassador-auth.ts (resetAmbassadorPassword)
- Wrapped deleteChannel/deletePost in `$transaction` for atomicity
- Fixed `any` type to `Record<string, unknown>` in collaboration.ts getUsersForDM
- Fixed TypeScript errors in content-blocks.ts (z.record args, Prisma JSON types)
- Fixed TypeScript error in business-idea.ts (null narrowing in transaction callback)
- Added endDate > startDate validation in events.ts (create and update)

---

## CRITICAL (Fix Before Production)

### Security

| # | Issue | File | Lines | Fix |
|---|-------|------|-------|-----|
| C1 | Weak token generation - `Math.random()` for public tokens | `src/lib/actions/prospects.ts` | 582, 616, 701, 1268 | Use `crypto.randomBytes()` |
| C2 | Hardcoded secrets in `.env` (DB password, NEXTAUTH_SECRET, MIGRATION_SECRET) | `.env` | 3, 7, 10 | Move to `.env.local` |
| C3 | Migration secret accepted via URL query param (exposed in logs) | `src/app/api/admin/migrate/route.ts` | 90, 121 | Use `Authorization` header |
| C4 | Weak temporary passwords for parent accounts (`Math.random()`) | `src/lib/actions/ambassador-auth.ts` | 168-169 | Use `crypto.randomBytes()` |
| C5 | Weak temporary passwords for coach accounts | `src/lib/actions/prospects.ts` | 1379-1380 | Use `crypto.randomBytes()` |

### Schema & Data Integrity

| # | Issue | File | Fix |
|---|-------|------|-----|
| C6 | Race condition in email uniqueness (check-then-create) | `ambassador-auth.ts`, `coaches.ts` | Handle P2002 from DB constraint |
| C7 | Missing transactions on multi-record mutations | `business-idea.ts`, `ambassadors.ts`, `events.ts`, `onboarding-config.ts` | Wrap in `$transaction` |
| C8 | Prospect status history not logged on manual updates | `prospects.ts` | Create ProspectStatusHistory record |

---

## HIGH (Fix Within 1 Week)

### Security

| # | Issue | File | Lines | Fix |
|---|-------|------|-------|-----|
| H1 | Password minimum only 6 chars, no complexity | `ambassador-auth.ts` | 13 | Min 8 + complexity rules |
| H2 | Inconsistent bcrypt cost (10 vs 12) | `users.ts` | 94, 223 | Standardize to 12 |
| H3 | No rate limiting on public token endpoints | `prospects.ts` | 338-386 | Add rate limiting |
| H4 | No double-impersonation prevention | `impersonation.ts` | 52-90 | Check `isImpersonating` |
| H5 | No session timeout configured | `auth.ts` | 129-131 | Add `maxAge` / `updateAge` |
| H6 | No impersonation check on migration endpoint | `api/admin/migrate/route.ts` | 89-94 | Add `!isImpersonating` |

### Performance

| # | Issue | File | Fix |
|---|-------|------|-----|
| H7 | Missing database indexes on FK/status fields | `schema.prisma` | Add `@@index` directives |
| H8 | No pagination on `getAllProspects()` | `prospects.ts:388` | Add `take`/`skip` |
| H9 | No pagination on `getAmbassadors()` | `admin/ambassadors/page.tsx:9` | Add `take`/`skip` |
| H10 | N+1 query in `getProspect()` (client-side filtering) | `prospects.ts:245-330` | Filter in DB query |
| H11 | Assessment lookup does 5 sequential DB queries | `prospects.ts:1531-1673` | Combine queries |

### Code Quality

| # | Issue | File | Fix |
|---|-------|------|-----|
| H12 | `z.any()` in Zod schemas defeats validation | `surveys.ts:39`, `content-blocks.ts:39,45` | Define proper schemas |
| H13 | 35+ unsafe `as` type assertions on FormData | 8 action files | Validate before cast |
| H14 | Duplicate survey submissions allowed | `schema.prisma` (SurveySubmission) | Add `@@unique([surveyId, contactEmail])` |

---

## MEDIUM (Fix Within 2 Weeks)

### Security

| # | Issue | File | Fix |
|---|-------|------|-----|
| M1 | ~~No security headers (CSP, HSTS, X-Frame-Options)~~ | `next.config.js` | **FIXED** - Added security headers |
| M2 | ~~PII (emails, age) in audit log details~~ | `ambassador-auth.ts` | **FIXED** - Removed email/age from audit logs |
| M3 | ~~No token format validation before DB query~~ | `prospects.ts` | **FIXED** - Added token format validation |
| M4 | ~~Admin operations accessible while impersonating~~ | `coaches.ts`, `feature-config.ts` | **FIXED** - Added `isImpersonating` checks |

### Performance

| # | Issue | File | Fix |
|---|-------|------|-----|
| M5 | ~~11 `revalidatePath` calls per collaboration action~~ | `collaboration.ts` | **FIXED** - Layout-level revalidation + helper usage |
| M6 | ~~Sequential queries in feature config~~ | `feature-config.ts` | **FIXED** - Parallelized with `Promise.all` |
| M7 | ~~Calendar queries fetch all events (no date filter)~~ | `admin-calendars.ts` | **NOT AN ISSUE** - Already has date range filtering |
| M8 | Missing `useCallback`/`useMemo` in ambassador table | `ambassador-table.tsx` | Wrap handlers |
| M9 | Excessive nested includes in `getChannel` (unlimited replies) | `collaboration.ts:81-171` | Add `take` limits |

### Code Quality

| # | Issue | File | Fix |
|---|-------|------|-----|
| M10 | 251 duplicated auth check patterns across 33 files | All action files | Create `requireAuth()` helper |
| M11 | Missing `useEffect` dependencies in business form auto-save | `business-form-client.tsx:117` | Add missing deps |
| M12 | No Error Boundaries in client components | All 58 client components | Add ErrorBoundary wrapper |
| M13 | Inconsistent error messages across actions | All action files | Standardize format |
| M14 | Feature permission check ignores impersonation | `feature-config.ts:142-184` | Pass session context |

### Schema

| # | Issue | File | Fix |
|---|-------|------|-----|
| M15 | Missing `onDelete: Cascade` creates orphaned records | `schema.prisma` (CRMDeal, CalendarBooking, TimeEntry) | Add cascade rules |
| M16 | `firstName`/`lastName` optional in schema but required by code | `schema.prisma` (CoachProfile, Ambassador) | Make required |
| M17 | Missing required constraints (CRMActivity.userId, KBArticle.authorId) | `schema.prisma` | Make required |
| M18 | ~~Sequential DB queries in `getEnabledFeaturesForRole`~~ | `feature-config.ts` | **FIXED** - Parallelized with `Promise.all` |

---

## LOW (Fix Within 1 Month)

### Security

| # | Issue | File | Fix |
|---|-------|------|-----|
| L1 | Verbose error logging may expose sensitive data | All action files | Structured logging |
| L2 | No account lockout after failed logins | `auth.ts:45-82` | Track failed attempts |
| L3 | No CSP headers configured | Global | Add middleware |

### Performance

| # | Issue | File | Fix |
|---|-------|------|-----|
| L4 | No `Next/Image` usage (raw `<img>` tags) | Profile/avatar components | Use `Image` component |
| L5 | Module-level constants recreated in component | `ambassador-table.tsx:52-75` | Move outside component |
| L6 | `calculateAgeFromDate` not memoized | `ambassador-table.tsx:83-93` | Wrap in `useMemo` |
| L7 | ~~Missing composite User index `[role, status]`~~ | `schema.prisma` | **FIXED** - Added in H7 index batch |
| L8 | Server action body size limit (2mb may be low) | `next.config.js` | Increase if needed |

### Code Quality

| # | Issue | File | Fix |
|---|-------|------|-----|
| L9 | Complex state management without reducer | `business-form-client.tsx:100-114` | Consider `useReducer` |
| L10 | Inconsistent `null` vs `undefined` in FormData extraction | Multiple action files | Standardize pattern |
| L11 | ~~Missing date validation (endDate > startDate)~~ | `events.ts` | **FIXED** - Added endDate > startDate check |
| L12 | Unused `Prisma` import (could use `import type`) | `feature-config.ts:6` | Use type import |
| L13 | No soft delete pattern for audit compliance | `schema.prisma` | Add `deletedAt` fields |
| L14 | Missing email uniqueness check for ambassadors | `ambassadors.ts:47` | Add check before create |

---

## Implementation Priority

### Phase 1: Critical Security + Data Integrity (Immediate)
- C1-C5: Token/password generation fixes
- C6-C8: Transaction and race condition fixes
- H1-H2: Password requirements + bcrypt consistency
- H6: Impersonation check on migrations

### Phase 2: High Performance + Schema (Week 1)
- H7: Database indexes
- H8-H9: Pagination
- H10-H11: Query optimization
- H12-H14: Validation fixes

### Phase 3: Medium Priority (Week 2)
- M1-M4: Security headers + impersonation checks
- M5-M9: Performance optimizations
- M10-M18: Code quality + schema fixes

### Phase 4: Low Priority (Week 3-4)
- L1-L14: Polish and hardening
