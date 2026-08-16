# NowTransformed Back Office — What Every Part Does, and How It Works

**Written:** 2026-08-14
**Audience:** anyone who needs to understand this system without reading code — program managers, new team members, stakeholders.
**How this was produced:** three reviewers read the actual source code (not just the existing notes) and traced each feature from the first click to the final saved database record. Where something looks finished but isn't, it says so plainly.

---

## 1. What this system is, in one paragraph

NowTransformed Back Office is a private web application that does two jobs. First, it **recruits and onboards new coaches**: a candidate fills out a public form, gets scheduled for calls, submits a business plan, gets interviewed, is accepted, pays a program fee, and becomes a coach account. Second, it **runs the organization day to day**: coaches manage young "ambassadors" (ages 10–24), everyone takes courses and surveys, and admins oversee all of it. There are four kinds of users and one public, no-login area used by candidates.

---

## 2. The four kinds of users

| Role | Who they are | What they do all day |
|---|---|---|
| **ADMIN** | Staff who run the organization | Move candidates through the recruitment pipeline, create accounts, build courses and surveys, review submissions, configure what everyone else can see |
| **COACH** | An adult mentor | Complete their own onboarding checklist, recruit and manage ambassadors, run classes, track income and goals |
| **AMBASSADOR** | A young person, 10–24, sponsored by a coach | Work through an onboarding checklist, take courses and surveys, submit a business idea, keep their profile updated |
| **PARENT** | Guardian of an ambassador under 18 | **Nothing — this role is created automatically but does not work.** See Section 9. |

A fifth role value, `SUB_ADMIN`, exists in the database but appears nowhere else in the code.

---

## 3. The shape of the app

There are three "doors" into the system:

- **The public door** — no account needed. Candidates use token links sent to them: the assessment form, the booking pages, the business form, the acceptance letter, the payment pages.
- **The staff door** (`/login`) — admins and coaches.
- **The ambassador door** (`/ambassador-login`) — visually different, but functionally the same login. Nothing stops a coach from using the ambassador page or vice versa; each person simply lands wherever their role sends them.

Once inside, everyone sees the same frame: a left sidebar whose menu depends on your role, and a top header with your name, a notification bell (admins), and the profile menu.

---

# PART ONE — The public area: how a stranger becomes a coach

This is the recruitment funnel. Nobody in this part has a login. Everything reaches them as a link an admin sends by hand.

## Step 1 — The assessment form

**What it is:** The first-contact questionnaire. Contact details plus three open-ended questions about motivation and commitment.

**Who acts:** A candidate, on their own. An admin generated and sent the link.

**How it works:**
1. Admin clicks "Get Assessment Link." The system creates the "Coach Assessment" survey the first time this is ever used — three required long-answer questions, marked public.
2. Admin shares the URL by email, text, or social.
3. The candidate fills in name, email, phone, and who referred them, then answers one question per screen with a progress bar.
4. On submit, the system saves the answers, then **creates a Prospect record** at status `ASSESSMENT_COMPLETED` with a unique tracking token, and writes a history entry.
5. Every active admin gets an in-app notification (the bell icon — not an email).
6. The candidate sees a finish screen offering a button to book their orientation immediately.

**Rough edge:** the finish screen tells the candidate to check their email. No email is ever sent at this step.

## Step 2 — Orientation booking

**What it is:** A Calendly-style page where the candidate picks a time for their orientation call.

**How it works:**
1. Admin generates an orientation token and sends the link.
2. The candidate sees a month view. Only dates with genuinely open capacity are shown, respecting a booking window (14 days out by default) and how many people have already booked. Times convert to the visitor's own timezone.
3. Picking a slot creates the booking, and — because the booking is tied to a prospect — **automatically** moves the prospect to `ORIENTATION_SCHEDULED`, timestamps it, writes a history entry, and notifies the admin who owns that calendar.
4. If several people are looking at the same calendar, availability updates live without anyone refreshing.
5. After the call, the admin clicks "Complete Orientation" → status `ORIENTATION_COMPLETED`.

The "Coach Orientation" calendar creates itself on first use (Mondays and Thursdays, 7am PT by default). An admin can also book a slot on the candidate's behalf.

**Rough edge:** the confirmation screen promises an email with meeting details. None is sent.

## Step 3 — The business development form

**What it is:** A five-part questionnaire about the business the candidate intends to build — identity, online presence, services and pricing, target audience, goals.

**How it works:**
1. Admin generates the form token, which also moves the prospect to `BUSINESS_FORM_PENDING`.
2. The candidate works through five steps. **Progress saves automatically every three seconds**, so they can close the tab and come back to the same link later.
3. Final submit validates everything, writes it onto the prospect record, clears the draft, moves status to `BUSINESS_FORM_SUBMITTED`, and notifies admins.

## Step 4 — The interview

Same pattern as orientation, on a separate "Biz Dev Interview" calendar (Tuesdays and Thursdays, 10am PT by default). Booking sets `INTERVIEW_SCHEDULED`. Afterwards the admin records the outcome, moving the prospect to `APPROVED` or `REJECTED`, and the calendar booking is marked completed or cancelled to match. A decision can be reversed — the system will restore the original booking if it's still in the future, or send the candidate back a step if not.

## Step 5 — Acceptance letter

**How it works:**
1. Admin clicks "Send Acceptance Letter" → generates a token, status becomes `ACCEPTANCE_PENDING`.
2. The candidate reads the acceptance letter and refund policy. **Both texts are editable by admins** in Settings → Legal Pages, so this isn't hardcoded.
3. They tick three boxes: terms, privacy, and acknowledgment that the fee is non-refundable. Each is timestamped separately.
4. Status moves to `PAYMENT_PENDING`.

## Step 6 — Payment ⚠️ **THIS STEP IS BROKEN**

**What it is meant to be:** a checkout for the $1,500 program fee, by card (Stripe), PayPal, or manual bank transfer.

**What it actually is:**
- The **Stripe** button links to a checkout route that **does not exist** in the codebase. It 404s. There is no Stripe library installed anywhere in the project.
- The **PayPal** button links to a route that **does not exist** either. No PayPal library either.
- **Manual payment** shows placeholder bank details (account "1234567890", routing "987654321") and **never saves anything** — the page calls no server function at all.
- The functions to record a manual payment, approve it, and reject it all exist in the code but **are called from nowhere**. There is no "Approve Payment" button anywhere in the admin screens.
- The payment success and cancel pages are fully built but **orphaned** — nothing ever links to them.

**Consequence:** once a candidate reaches `PAYMENT_PENDING`, nothing in the running application can move them forward. "Create Coach Account" only appears at `PAYMENT_COMPLETED`, and no code path produces that status. **Today the funnel cannot be completed without editing the database by hand.**

## Step 7 — Coach account creation

Once a prospect is (somehow) at `PAYMENT_COMPLETED`, the admin clicks "Create Coach Account." In one safe transaction the system creates: the login account with a random temporary password, the coach profile at status `ONBOARDING_INCOMPLETE`, a blank Business Excellence record, and a website content record pre-filled from what they wrote in the business form. The prospect flips to `ACCOUNT_CREATED`.

The temporary password is **shown once on the admin's screen** for them to pass along manually. It is not emailed.

**Safety rail:** a prospect can no longer be deleted once their coach account exists.

---

# PART TWO — The Admin area, section by section

## Dashboard
Landing page with headline counts (total coaches, total ambassadors, and so on) and a welcome header. Read-only.

## People

### Prospects
The recruitment pipeline described in Part One, seen from the admin's side: a filterable list, and a detail page per candidate that shows **everything they submitted inline** — assessment answers, business form, orientation and interview notes, terms acceptance, payment record. A "Generated Links" panel keeps every link that has been created so it can be re-sent. The "Send Email" buttons open the admin's *own* mail client with pre-filled text; the app does not send anything itself.

### User Management
**Actors:** admin only.
1. Create a login directly: email, password, role (admin, coach, or ambassador), optional name. Creating a coach here also creates a bare coach profile. Creating an ambassador here does **not** create an ambassador profile — those must go through the coach's ambassador flow, because they need a coach attached.
2. Change someone's role, reset their password, or delete them (you cannot delete yourself).
3. Set per-person feature overrides: for each of the six optional tools, choose **Default**, **Grant** (always on for this person), or **Deny** (always off).

All of this is written to the audit log.

**Rough edge:** password rules disagree across the app. Admin-created accounts need only **6 characters**. Admin-performed resets need **8, no complexity**. Self-service resets and coach/ambassador creation need **8 with an uppercase, a lowercase, and a number.**

### Coaches
Create a coach (email, password, name, optional phone/location/recruiter). One transaction creates the login, the profile, and the blank Business Excellence and website records. Admins can also suspend a coach's login, reset their password, and override any onboarding step.

**A coach becomes "Active" automatically** when two conditions are both true: every required onboarding task is approved, **and** they have at least **two approved ambassadors**. No admin click is needed.

### Ambassadors
Create an ambassador account (by an admin, or by a coach for their own roster):
1. Name, email, password, date of birth are required. Age must be **between 10 and 24**.
2. If the calculated age is **under 18**, parent/guardian name, email, and relationship become required.
3. In one transaction the system creates the ambassador's login, creates a **separate PARENT login account** with a random password if under 18, creates the ambassador profile linked to their coach and parent, records that consent was given with a timestamp, and **seeds their entire onboarding checklist** so tasks are waiting on first login.

There is also a lighter option for coaches: log a prospective ambassador's basic details with no login account at all.

Only admins can change an ambassador's status (`PENDING`, `APPROVED`, `INACTIVE`, `COMPLETED`, `ON_HOLD`). Coaches can only act on ambassadors that belong to them.

## Assessments

### Surveys & Quizzes
The most complete module in the system, and the engine behind the public assessment form.

1. Admin creates a survey or quiz and chooses audience roles, scoring mode (none, score only, or pass/fail), retake policy, and open/close dates. It starts as a draft.
2. Questions come in five types: multiple choice, multiple select, Likert scale, short text, long text. They can be grouped into **pages** (several questions on one screen with a section heading) or left standalone (one per screen).
3. Questions can be reordered, duplicated, and moved between pages, all saving instantly.
4. **Preview mode** lets an admin walk through a draft without saving anything and skip required fields.
5. Publishing makes it visible to the chosen roles.
6. Quizzes **auto-grade** the choice-based questions against the marked correct answers, compute a percentage, and apply the pass mark. Text and Likert questions are not scored.
7. Results show per-question breakdowns, response distributions, free-text answers, and pass rate — and export to CSV.

## Onboarding & Training

### Onboarding Config (coaches)
Admins define the coach checklist. Task types: manual status, video, quiz, upload, yes/no, PDF flipbook, and ambassador introduction. Each task can be required or optional, active or retired, and ordered.

Coaches then work the list. Photo uploads are capped at 5MB (JPEG/PNG/WebP). Quizzes require **80% or better** to pass. Each change updates that coach's progress record, and the system re-checks whether they now qualify as an Active Coach.

### Ambassador Onboarding
A parallel checklist with its own task types: interview, WhatsApp team, business idea, Power Team, class selection, manual status. Three of these are admin actions with side effects:
- **Approve interview** — marks the task approved.
- **Mark WhatsApp team created** — flags it on the ambassador record with an optional group link, and approves the task.
- **Invite to Power Team** — flags and timestamps it, and approves the task.

Coaches and ambassadors can move a task to in-progress or submitted, but **only an admin can approve or reject**.

### Courses (LMS)
1. Admin creates a course (draft), then modules, then lessons, then content blocks — video, text, document, or quiz.
2. Publishing is blocked unless the course actually contains modules, lessons, and content.
3. Learners see only published courses matching their role, and only after finishing any prerequisite course.
4. Enrolling starts them at 0%; opening the first lesson marks them in progress.
5. Completing any block recalculates the course percentage live and marks the course complete when everything is done.

**Rough edges:** clicking "Mark Complete" on a *quiz* block completes it **whether or not the quiz was taken or passed**. Video progress auto-tracks only for self-hosted files — YouTube and Vimeo videos require a manual click. "Time spent" and "average completion time" in analytics read a database field **nothing ever writes**, so they always show zero. Certificates have database fields but no code that generates them.

### Business Ideas
1. Ambassador writes a title, description (10 characters minimum), target market, and resources needed. One idea per ambassador, ever.
2. Save keeps it as a draft; Submit moves it to `SUBMITTED` — allowed only from draft or "needs revision" — and **simultaneously updates their onboarding checklist** so the two never drift apart.
3. Admin marks it in review, then approves, requests revision, or rejects, with optional feedback.
4. **Approving also auto-approves the matching onboarding task.** Every review is audit-logged.

## Content

### Knowledge Base
Admins write categories and articles, set which roles may see them, and publish, archive, or delete.

**Partly broken, verified:** there is **no edit page** — the Edit link points at a page that doesn't exist, so a published article can never be changed. On the coach and ambassador side, the links to open a category or read a full article **also point at pages that don't exist**, so they can see titles and excerpts but cannot actually read anything. The search boxes do nothing when typed into.

### Resource Centers
A graduate program. A coach who has personally recruited **five or more** coaches automatically becomes eligible to apply to run a physical community hub. They submit one application (location, community, vision, capacity); an admin approves it (or declines with a required reason); approval **automatically creates** the Resource Center. The coach then logs classes with date, audience, and attendance, and totals tally themselves. Fully working.

## Events & Finance

### Calendars
The booking engine behind the whole recruitment funnel, and the most heavily engineered module in the app. Admins create calendars, choose whether they are for booking or display only, set visibility (everyone, coaches only, ambassadors only, named individuals, or fully public), and define slot length, buffer time, capacity per slot, whether bookings need approval, and how far ahead people may book. Slots can be weekly recurring, one-off, or individual events dropped on the calendar. Capacity is re-checked on the server at the moment of booking so two people can't take the last seat. Admins can confirm or cancel bookings and edit recurring series ("this event", "this and following", "all").

**Rough edges:** this screen still uses **23 browser pop-up alerts** for messages instead of the app's normal inline banners, and leftover debug logging ships to production.

### Events
A separate, simpler system for organization-wide events. Admins create an event with optional qualification rules (for example "must have completed onboarding" or "3+ approved ambassadors"). Coaches see whether they currently qualify — recalculated on the spot — and RSVP yes, no, or maybe. Working.

### Sponsorship Requests
Coaches request funding for themselves, an ambassador, or a project: amount, reason, urgency, optional self-contribution. Coaches can delete a request only before review begins. Admins mark it under review, then decide: approve in full, approve partially, set a payment plan, or decline.

**Data gap:** there is **no field for the actual approved amount** on a partial approval. Totals keep using the originally requested figure, so approved-dollar reporting can overstate reality. The Reports screen shows a dash in that column for the same reason.

### Business Excellence
A coach readiness tracker with three parts: a flag for whether they've activated an external CRM tool, a website content checklist, and outreach activity targets with logged progress.

**Partly broken:** the website content checklist is **read-only — no button exists to tick anything off**, and the save function behind it writes to database fields that don't exist, so it would fail even if something called it. The CRM flag and outreach logging work fine.

## Communication

### Channels
Slack-style shared channels. Only admins create, edit, or delete channels and set which roles may see them. Anyone permitted can read; joining formally makes you a member for unread counts. Posting, threaded replies, editing, deleting, and pinning all work, respecting author and admin permissions. Emoji reactions work fully.

**Built but not connected, verified:** typing "@" shows a live person-picker and inserts a highlighted mention — **but no notification is ever created**, so the tagged person never finds out. File attachments on messages and meeting links (Zoom/Meet/Teams) are fully built end to end — database, server functions, finished UI components — and **wired to no page**, so there is no button anywhere to use them.

### Direct Messages
One-to-one conversations. Works, but much simpler than channels: no reactions, mentions, threading, or attachments.

### Files
A searchable list of shared documents with download links and role-based visibility. "Uploading" really means pasting a link to something hosted elsewhere (Google Drive and the like) — the app stores no files.

## System

### Feature Config
Six optional tools can be switched on or off globally and per role:

| Tool | Coach default | Ambassador default |
|---|---|---|
| CRM | On | Off |
| Project Management | On | Off |
| Collaboration | On | On |
| Time Clock | On | On |
| Scheduling | On | On |
| Knowledge Base | On | On |

When someone opens one of these pages the check runs in order: is it off globally (then nobody gets it), does this person have a personal Grant/Deny override (that wins), otherwise use the role default. The page self-heals — it creates any missing feature rows automatically. Note that the LMS is **not** on this list and cannot be switched off.

### Reports
About twenty live database queries: headline counts plus detail tables for coaches, ambassadors, sponsorships, and events, each exportable to CSV from the browser. Every figure is real, not mocked — except the approved-amount column noted above, and the course pass-rate figures, which read the retired legacy course system and are therefore frozen forever.

### Audit Logs
A searchable history of who did what, 50 at a time. Roughly fifty different actions across eighteen files write here — account creation and deletion, admin-initiated password resets, impersonation starts, business idea reviews, feature changes.

**Coverage gaps:** ordinary logins and logouts are never recorded (the screen even has ready-made badges for them that will never appear), self-service password resets leave no trace, and **ending** an impersonation isn't logged even though starting one is. The IP address column exists but is always blank.

### Settings
Four tabs, but only one of them saves anything: **Legal Pages**, where admins edit the Terms, Privacy Policy, Refund Policy, and Acceptance Letter text that the public pages display. The Features tab is a read-only summary pointing at the real toggle page. The System tab shows green "Connected" and "Configured" badges that are **hardcoded, not live checks**.

### Database Migrations
A powerful maintenance page that can restructure the live production database — either by syncing it to match the app's design (with an "accept data loss" checkbox for risky changes) or by running a fixed list of one-time developer-written changes, each tracked so it runs only once. Output streams to the screen and is scrubbed of database passwords first.

**Security note:** this page has two independent ways in — an admin login, **or** a standalone secret key that bypasses login entirely, meant for deploy scripts. That key deserves the same protection as an admin password.

---

# PART THREE — The Coach area

**Dashboard** — personal summary.
**Onboarding** (top-level link, coaches only) — the checklist described above; completing it plus two approved ambassadors makes them an Active Coach automatically.

| Section | Contains | State |
|---|---|---|
| People | Ambassadors — create and manage their own roster | Working |
| Assessments | Surveys & Quizzes assigned to them | Working |
| Business | CRM · Projects · Business Excellence · Income & Goals | **CRM and Projects are empty shells** — see below |
| Content | Learning (LMS courses) · Knowledge Base | LMS works; KB can't open articles |
| Communication | Channels · Direct Messages · Files | Working |
| Tools | Time · Schedule · Events · Sponsorship · Resource Center | Schedule is a shell; rest work |

**CRM — a stub.** The database is fully designed for contacts, deals, pipeline stages, and activity logs. **None of those tables is ever read or written by any code in the project.** The page shows four stat tiles hardcoded to zero and a pipeline panel that always says "No deals yet." No button does anything.

**Projects — a stub.** Same story. The page always says "No projects yet" and the "New Project" button has no handler at all.

**Income & Goals — working.** Coaches log income entries and set one goal per week with a numeric target, then self-report the outcome. Monthly and weekly totals calculate automatically.

**Time — mostly working.** Clock in, break, and clock out are fully built. The separate "project timer" runs as a stopwatch but, because Projects don't exist, can never attach to a real project — in practice it's an unlabeled personal timer. "Billable hours" always reads zero because there's no way to mark anything billable.

**Schedule — a stub.** Hardcoded to "No events scheduled" regardless of what's in the database, and "New Event" does nothing. Note the irony: a complete, production-quality booking calendar exists on the admin side; this personal view simply never calls it.

---

# PART FOUR — The Ambassador area

**Dashboard**, then **Onboarding** as a top-level link (their checklist, seeded automatically when their account was created).

| Section | Contains | State |
|---|---|---|
| Assessments | Surveys & Quizzes | Working |
| Learning | Courses (LMS) · Knowledge Base | LMS works; KB can't open articles |
| Business | Business Idea | Working |
| Tools | Time Clock · Schedule · Channels · Messages | Schedule is a stub; rest work |
| Account | Profile | Working |

**Profile** — ambassadors edit their own name, phone, region, bio, photo, and social links (Instagram, Facebook, X, TikTok, LinkedIn, YouTube, website).

---

# PART FIVE — The machinery underneath

## Logging in
Wrong password five times within fifteen minutes locks that email for fifteen minutes. The message never changes — always "Invalid email or password" — so nobody can use the login form to discover which emails exist, and a locked-out user is never told that's what happened. Sessions last seven days and refresh silently if used within twenty-four hours. Only active accounts can log in.

**Limitation:** the lockout counter lives in the app's memory. It **resets on every restart or deployment**, and if the app is ever run on more than one server, each server counts separately.

## Password reset
Request a link, get a 64-character random token that expires in **60 minutes**, click it, set a new password (8 characters with an uppercase, lowercase, and number). Requesting a new link cancels the old one, and the link is single-use — the password change and the token being marked used happen together in one transaction.

**Broken in production:** the email utility has an explicit unfinished note in the code. In production, with no provider connected, it logs a warning and **silently sends nothing**. The user sees a success message and waits forever.

## Impersonation — "log in as user"
An admin can view the app exactly as a coach or ambassador sees it, without their password. Starting one is audit-logged. An amber banner runs across every page while it's active. It **expires automatically after 30 minutes** — checked on essentially every request — and silently reverts with no warning.

**Inconsistency:** impersonating admins are correctly blocked from some sensitive actions (creating coaches, resetting coach passwords, changing feature config) but **not others** — they can still delete an ambassador, reset an ambassador's password, or create and delete users while wearing someone else's identity.

## Email — the single biggest structural gap
`src/lib/email.ts` is imported by **exactly one file** in the entire codebase (password reset), and `sendEmail()` has **exactly one call site**. Nothing else in the application sends mail to anyone, ever.

Every one of these screens promises the reader an email that never arrives:
- Assessment submitted — "check your email"
- Booking confirmed — "you will receive a confirmation email with meeting details"
- Manual payment — "you will receive an email once payment is confirmed"
- Payment success — receipt email
- Password reset — the reset link itself, in production

In practice, every handoff in this system depends on an admin copying a link and pasting it into their own mail client. The "Send Email" buttons do exactly that — they open the admin's mail app; they send nothing server-side.

---

# 9. The parent problem

Parent accounts are created automatically and correctly for every ambassador under 18 — role assigned, consent recorded, profile linked. Then three things make them useless:

1. **The password is unknowable.** It's randomly generated, hashed, and stored. It is never displayed to anyone and never emailed.
2. **There is no parent dashboard.** No `/parent` route exists. The landing redirect sends anything that isn't an admin or ambassador to the coach area, and the coach area rejects anyone who isn't a coach and sends them back to the login page — an endless loop.
3. **The menu doesn't know they exist.** The sidebar only recognizes three roles and quietly shows a parent the *ambassador's* menu.

Recovering the password by "forgot password" also fails, because that flow sends no email in production. **This feature should either be finished or the automatic account creation should be paused until it is.**

---

# 10. Honest status of every module

**Fully working**
Surveys & Quizzes · Admin booking calendars · Prospect pipeline (except payment) · Coach and ambassador onboarding · Business Ideas · Events & RSVPs · Sponsorship (with the data gap noted) · Income & Goals · Resource Centers · Reports · Audit Logs · Feature Config · Impersonation · Time Clock attendance · Channels, DMs and reactions · Database Migrations

**Partly working**
LMS (quiz completion isn't verified; no certificates; time-tracking always zero) · Knowledge Base (can't edit; can't read articles) · Business Excellence (website checklist read-only and broken behind the scenes) · Settings (only Legal Pages saves) · Collaboration (mentions notify nobody; attachments and meeting links unwired) · Time Clock project timer (no projects to attach to)

**Not built — menu item only**
CRM · Project Management · Coach Schedule · Ambassador Schedule · Parent role

**Dead code**
The original Course/Quiz system, replaced by the LMS. Its "Start Course" buttons point at a page that no longer exists, and two admin reports still display its frozen pass-rate numbers as though they were live.

---

# 11. What to fix first

1. **Payment.** The recruitment funnel physically cannot complete. Either build the Stripe/PayPal routes or, far cheaper as a stopgap, wire up the manual-payment functions that already exist and add an "Approve Payment" button for admins.
2. **Email.** Connect a provider. Until then, five screens are lying to users and password reset is dead in production.
3. **Parent accounts.** Finish the role or stop creating the accounts.
4. **Knowledge Base pages.** Three missing pages make an otherwise complete feature unusable for its actual readers.
5. **Standardize password rules.** Six characters for admin-created accounts is the weak link.
6. **Sponsorship approved amount.** Add the field — the current reporting overstates approved funding.
7. **Decide about CRM and Projects.** Either build them or remove them from the menu, so nobody plans around tools that don't exist.
8. **Close the impersonation gaps** on ambassador and user-management actions.
