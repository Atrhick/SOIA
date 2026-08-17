# Performance Audit Report - NowTransformed Back Office

**Date:** 2026-02-12
**Audited By:** Claude Code

---

## CRITICAL (Fix Immediately)

### 1. N+1 Query Loops in `prospects.ts`
**Lines 976-995 & 1221-1231** — `completeInterview()` and `cancelInterviewBooking()` update bookings one-by-one in a loop. With 10 bookings, that's 10 separate UPDATE queries.
**Fix:** Use `prisma.calendarBooking.updateMany()` with `{ id: { in: [...] } }` for a single batch update.

### 2. Unbounded Queries Without Pagination
- **`getAllProspects()`** (`prospects.ts:394-447`) — No `take`/`skip`, could fetch 100K+ records
- **`getChannels()`** (`collaboration.ts:35-71`) — No limit on channels
- **`getProspect()`** (`prospects.ts:240-337`) — `calendarBookings` and `statusHistory` have no limit
- **`getLMSOverviewStats()`** (`lms/analytics.ts:83-89`) — Fetches ALL completed enrollments instead of using `aggregate()`

**Fix:** Add `take`/`skip` pagination, use `prisma.lMSEnrollment.aggregate()` for stats.

### 3. Over-Fetching with `include: true` Instead of `select`
- **`admin/coaches/page.tsx:21-56`** — Fetches full User, all Ambassador fields, full recruiter objects when only counts/names are needed
- **`admin/ambassadors/page.tsx:9-20`** — Full User objects when only email needed
- **`admin/coaches/[id]/page.tsx:6-22`** — All fields on all relations

**Fix:** Replace `include` with targeted `select` clauses, use `_count` for counts.

### 4. Unoptimized Images — `<img>` Instead of `next/image`
- `learning-catalog-client.tsx:256-259, 344`
- `course-view-client.tsx:170-173`
- `lms-admin-client.tsx` (multiple)

**Fix:** Replace with `<Image>` from `next/image` for automatic optimization, lazy loading, and responsive sizing.

---

## HIGH PRIORITY (This Sprint)

### 5. Mega Component — `survey-builder-client.tsx` (1,729 lines)
Any state change (e.g., expanding a question) re-renders the entire tree including all charts and forms. 15+ `useState` hooks in one component.
**Fix:** Split into `SurveySettingsForm`, `QuestionBuilder`, `PageManager`, `QuestionsList`. Move UI state (like `expandedQuestion`) into child components.

### 6. Dashboard Layout DB Query on Every Navigation
**`(dashboard)/layout.tsx:23-40`** — Fetches coach/ambassador profile name from DB on every page load within the dashboard.
**Fix:** Include profile name in the JWT session token so it's available without a DB query.

### 7. No Suspense Boundaries for Streaming
Pages like `admin/ambassadors/page.tsx` await 3 parallel queries but block the entire page until all resolve.
**Fix:** Wrap non-critical sections in `<Suspense>` with skeleton fallbacks so the page streams progressively.

### 8. Missing `loading.tsx` Files
These pages have no loading state, causing blank screens during navigation:
- `admin/audit-logs/`
- `admin/lms/`
- `admin/events/`
- `admin/business-ideas/`

### 9. Sequential Assessment Lookup — Up to 5 Queries
**`prospects.ts:1537-1612`** — `getProspectAssessmentResults()` chains up to 5 sequential queries as fallback lookups.
**Fix:** Consolidate into 2 queries max using `OR` conditions in a single `findFirst()`.

### 10. Recharts Loaded Eagerly (~70KB)
**`survey-results-client.tsx:15-27`** — Full Recharts library imported at top level even if user never views charts tab.
**Fix:** Use `dynamic(() => import(...), { ssr: false })` to lazy-load chart components.

---

## MEDIUM PRIORITY (Next Sprint)

### 11. Missing `useMemo` / `useCallback`
- `survey-results-client.tsx:171-174` — `roleData` recalculated every render
- `ambassador-table.tsx:83-93` — Age calculation runs every render
- `survey-builder-client.tsx:1239-1246` — Likert scale array recreated every render
- `EmojiPicker.tsx:52-55` — `handleSelect` recreated every render

### 12. Form State Causing Full Re-renders
**`ambassador-table.tsx:100-125`** — Every keystroke in the form re-renders the entire ambassador table because form state lives at the top level.
**Fix:** Extract the form into a separate child component, or use `react-hook-form` (already a dependency).

### 13. Unstable List Keys
- `survey-builder-client.tsx:1138` — Options list uses `index` as key
- `survey-results-client.tsx:476` — Responses use `index` as key

**Fix:** Use stable IDs (`crypto.randomUUID()` for options, database IDs for responses).

### 14. Repeated Admin Lookup Query
**`prospects.ts`** — Same `prisma.user.findMany({ where: { role: 'ADMIN' } })` appears in 5+ functions.
**Fix:** Parallelize with `Promise.all()` alongside the main operation, or extract to a cached helper.

### 15. Font Optimization
**`layout.tsx`** — Inter font loaded without `display: 'swap'` or weight restrictions.
**Fix:** Add `display: 'swap'`, `weight: ['400', '500', '600', '700']`.

### 16. No Cache-Control on API Routes
**`api/coaches/list/route.ts`** — No caching headers on API responses.
**Fix:** Add `Cache-Control: private, max-age=3600` for appropriate routes.

---

## LOW PRIORITY (Backlog)

### 17. Missing Database Indexes
Add composite indexes for frequently queried patterns:
- `CalendarBooking`: `@@index([prospectId, status])`
- `SurveySubmission`: `@@index([surveyId, contactEmail])`
- `ChannelPost`: `@@index([channelId, createdAt])`
- `LMSEnrollment`: `@@index([userId, courseId])`

### 18. `next.config.js` Enhancements
Add `images: { formats: ['image/avif', 'image/webp'] }` and verify `compress: true`.

### 19. SessionProvider Scope
`Providers` wraps the entire app. Move it to only wrap `(dashboard)` layout to avoid hydrating public/auth pages unnecessarily.

### 20. Unused Tailwind Animations
`tailwind.config.ts` defines ~8 custom animations that may not be used, inflating CSS bundle.

---

## Summary

| Category | Critical | High | Medium | Low |
|----------|----------|------|--------|-----|
| Database/Queries | 3 | 2 | 2 | 1 |
| React Components | — | 2 | 4 | — |
| Next.js/Config | 1 | 3 | 2 | 3 |
| **Total** | **4** | **7** | **8** | **4** |
